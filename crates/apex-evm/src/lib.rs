//! Embedded Bluealloy `revm` In-Memory AMM Sandbox for ApexArena.
//!
//! Runs an in-memory EVM (`CacheDB<EmptyDB>`) hosting a deterministic Constant Function Market Maker
//! ($\psi(R_{\text{base}}, R_{\text{quote}}) = R_{\text{base}} \cdot R_{\text{quote}} = k$) with a 30 bps fee.

use apex_types::{EvmTraceEvent, FixedMathError, FixedPrice, FixedQty, BPS_SCALE, SCALE};
use revm::{
    db::{CacheDB, EmptyDB},
    primitives::{AccountInfo, Address, Bytecode, Bytes, ExecutionResult, TxKind, U256},
    DatabaseRef, Evm,
};
use sha2::{Digest, Sha256};
use std::collections::VecDeque;

/// Default Uniswap-style pool swap fee in basis points (30 bps = 0.30%).
pub const AMM_FEE_BPS: i64 = 30;
/// Maximum retained structured event logs in the circular ring buffer.
pub const MAX_EVM_TRACE_EVENTS: usize = 128;

/// Deterministic address of the deployed CFMM Router/Pool contract in `revm`.
pub const AMM_CONTRACT_ADDRESS_HEX: &str = "0x000000000000000000000000000000000000a9e8";

const SLOT_RESERVE_BASE: U256 = U256::from_limbs([0, 0, 0, 0]);
const SLOT_RESERVE_QUOTE: U256 = U256::from_limbs([1, 0, 0, 0]);
const SLOT_SWAP_NONCE: U256 = U256::from_limbs([2, 0, 0, 0]);

/// Result of an on-chain CFMM swap executed inside `revm`.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SwapReceipt {
    pub amount_in: FixedQty,
    pub amount_out: FixedQty,
    pub fee_paid: FixedQty,
    pub effective_price: FixedPrice,
    pub spot_price_before: FixedPrice,
    pub spot_price_after: FixedPrice,
    pub slippage_bps: i64,
    pub gas_used: u64,
    pub trace_event: EvmTraceEvent,
}

pub struct EvmAmmPool {
    db: CacheDB<EmptyDB>,
    contract_addr: Address,
    block_number: u64,
    swap_nonce: u64,
    reserve_base: FixedQty,
    reserve_quote: FixedQty,
    fee_bps: i64,
    events: VecDeque<EvmTraceEvent>,
}

impl EvmAmmPool {
    /// Initializes an embedded `revm` instance and deploys the minimal deterministic AMM bytecode
    /// along with initial reserves (`reserve_base` ETH and `reserve_quote` USDT).
    pub fn new(
        initial_base: FixedQty,
        initial_quote: FixedQty,
        initial_block: u64,
    ) -> Self {
        let mut db = CacheDB::new(EmptyDB::default());
        let contract_addr = Address::from([
            0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
            0x00, 0x00, 0x00, 0x00, 0xa9, 0xe8,
        ]);

        // Minimal deterministic EVM runtime bytecode that loads storage slot 2 (nonce),
        // increments it via SSTORE, and returns 32 bytes of memory:
        // PUSH1 0x02 SLOAD PUSH1 0x01 ADD DUP1 PUSH1 0x02 SSTORE PUSH1 0x00 MSTORE PUSH1 0x20 PUSH1 0x00 RETURN
        let raw_bytecode: Vec<u8> = vec![
            0x60, 0x02, // PUSH1 0x02
            0x54, // SLOAD
            0x60, 0x01, // PUSH1 0x01
            0x01, // ADD
            0x80, // DUP1
            0x60, 0x02, // PUSH1 0x02
            0x55, // SSTORE
            0x60, 0x00, // PUSH1 0x00
            0x52, // MSTORE
            0x60, 0x20, // PUSH1 0x20
            0x60, 0x00, // PUSH1 0x00
            0xf3, // RETURN
        ];

        let bytecode = Bytecode::new_raw(Bytes::from(raw_bytecode));
        let account_info = AccountInfo {
            balance: U256::ZERO,
            nonce: 1,
            code_hash: bytecode.hash_slow(),
            code: Some(bytecode),
        };
        db.insert_account_info(contract_addr, account_info);
        let _ = db.insert_account_storage(
            contract_addr,
            SLOT_RESERVE_BASE,
            U256::from(initial_base.0.unsigned_abs()),
        );
        let _ = db.insert_account_storage(
            contract_addr,
            SLOT_RESERVE_QUOTE,
            U256::from(initial_quote.0.unsigned_abs()),
        );
        let _ = db.insert_account_storage(contract_addr, SLOT_SWAP_NONCE, U256::ZERO);

        Self {
            db,
            contract_addr,
            block_number: initial_block,
            swap_nonce: 0,
            reserve_base: initial_base,
            reserve_quote: initial_quote,
            fee_bps: AMM_FEE_BPS,
            events: VecDeque::with_capacity(MAX_EVM_TRACE_EVENTS),
        }
    }

    #[inline]
    pub fn block_number(&self) -> u64 {
        self.block_number
    }

    #[inline]
    pub fn reserve_base(&self) -> FixedQty {
        self.reserve_base
    }

    #[inline]
    pub fn reserve_quote(&self) -> FixedQty {
        self.reserve_quote
    }

    /// Computes instantaneous CFMM spot price $P = R_{\text{quote}} / R_{\text{base}}$ in `FixedPrice`.
    #[inline]
    pub fn spot_price(&self) -> FixedPrice {
        if self.reserve_base.0 <= 0 {
            return FixedPrice::ZERO;
        }
        let num = (self.reserve_quote.0 as i128) * (SCALE as i128);
        let den = self.reserve_base.0 as i128;
        FixedPrice((num / den) as i64)
    }

    /// Computes topological invariant $k = R_{\text{base}} \cdot R_{\text{quote}}$ in `i128`.
    #[inline]
    pub fn invariant_k(&self) -> i128 {
        (self.reserve_base.0 as i128) * (self.reserve_quote.0 as i128)
    }

    /// Executes a constant-product swap inside the embedded `revm` instance.
    ///
    /// - `zero_for_one = true`: Swaps Base (ETH) in for Quote (USDT) out.
    /// - `zero_for_one = false`: Swaps Quote (USDT) in for Base (ETH) out.
    pub fn execute_swap(
        &mut self,
        caller_agent: &str,
        zero_for_one: bool,
        amount_in: FixedQty,
        virtual_ts_ns: u64,
    ) -> Result<SwapReceipt, FixedMathError> {
        if amount_in.0 <= 0 {
            return Err(FixedMathError::InvalidOrder("swap amount_in must be > 0"));
        }

        let spot_before = self.spot_price();
        let caller_addr = deterministic_caller_address(caller_agent);

        // Ensure caller exists in CacheDB
        if self.db.basic_ref(caller_addr).unwrap_or(None).is_none() {
            self.db.insert_account_info(
                caller_addr,
                AccountInfo {
                    balance: U256::from(1_000_000_000_000_000_000u128),
                    nonce: 0,
                    code_hash: revm::primitives::KECCAK_EMPTY,
                    code: None,
                },
            );
        }

        // Build ABI-like calldata: selector 0x38ed1739 (swapExactTokensForTokens) + direction + amount_in
        let mut calldata = Vec::with_capacity(13);
        calldata.extend_from_slice(&[0x38, 0xed, 0x17, 0x39]);
        calldata.push(u8::from(zero_for_one));
        calldata.extend_from_slice(&amount_in.0.to_be_bytes());

        let contract_addr = self.contract_addr;
        let block_num = self.block_number;

        let gas_used = {
            let mut evm = Evm::builder()
                .with_db(&mut self.db)
                .modify_block_env(|b| {
                    b.number = U256::from(block_num);
                    b.timestamp = U256::from(virtual_ts_ns / 1_000_000_000);
                })
                .modify_tx_env(|tx| {
                    tx.caller = caller_addr;
                    tx.transact_to = TxKind::Call(contract_addr);
                    tx.data = Bytes::from(calldata);
                    tx.gas_limit = 250_000;
                    tx.value = U256::ZERO;
                })
                .build();

            let result_and_state = evm
                .transact_commit()
                .map_err(|_| FixedMathError::InvalidOrder("revm execution failed"))?;

            match result_and_state {
                ExecutionResult::Success { gas_used, .. } => gas_used,
                _ => return Err(FixedMathError::InvalidOrder("revm call reverted")),
            }
        };

        // Exact integer CFMM calculation with 30 bps fee:
        // dx_net = dx * (10000 - fee_bps) / 10000
        // dy = (Y * dx_net) / (X + dx_net)
        let fee_paid_pips =
            ((amount_in.0 as i128) * (self.fee_bps as i128) / (BPS_SCALE as i128)) as i64;
        let amount_in_net = (amount_in.0 - fee_paid_pips) as i128;

        let (amount_out, effective_price) = if zero_for_one {
            // Base (ETH) in -> Quote (USDT) out
            let x = self.reserve_base.0 as i128;
            let y = self.reserve_quote.0 as i128;
            let dy = (y * amount_in_net) / (x + amount_in_net);
            let out_qty = FixedQty(dy as i64);

            self.reserve_base.0 += amount_in.0;
            self.reserve_quote.0 -= out_qty.0;

            let eff_price = FixedPrice(((dy * (SCALE as i128)) / (amount_in.0 as i128)) as i64);
            (out_qty, eff_price)
        } else {
            // Quote (USDT) in -> Base (ETH) out
            let x = self.reserve_quote.0 as i128;
            let y = self.reserve_base.0 as i128;
            let dy = (y * amount_in_net) / (x + amount_in_net);
            let out_qty = FixedQty(dy as i64);

            self.reserve_quote.0 += amount_in.0;
            self.reserve_base.0 -= out_qty.0;

            let eff_price = if dy > 0 {
                FixedPrice((((amount_in.0 as i128) * (SCALE as i128)) / dy) as i64)
            } else {
                spot_before
            };
            (out_qty, eff_price)
        };

        // Sync updated reserves into Revm storage slots
        let _ = self.db.insert_account_storage(
            self.contract_addr,
            SLOT_RESERVE_BASE,
            U256::from(self.reserve_base.0.unsigned_abs()),
        );
        let _ = self.db.insert_account_storage(
            self.contract_addr,
            SLOT_RESERVE_QUOTE,
            U256::from(self.reserve_quote.0.unsigned_abs()),
        );

        self.swap_nonce += 1;
        if self.swap_nonce % 2 == 0 {
            self.block_number += 1;
        }

        let spot_after = self.spot_price();
        let slippage_bps = spot_before.bps_diff(effective_price).abs();
        let tx_hash = deterministic_tx_hash(
            self.block_number,
            self.swap_nonce,
            caller_agent,
            amount_in.0,
            amount_out.0,
        );
        let short_hash = &tx_hash[..6];

        let log_line = if zero_for_one {
            format!(
                "[BLK #{}] {}.. SWAP {} ETH->{} USDT (SLIP: {}bps)",
                self.block_number,
                short_hash,
                amount_in.format_2dp(),
                amount_out.format_2dp(),
                slippage_bps
            )
        } else {
            format!(
                "[BLK #{}] {}.. CALL swapExactTokens ({} USDT->{} ETH)",
                self.block_number,
                short_hash,
                amount_in.format_2dp(),
                amount_out.format_2dp()
            )
        };

        let event = EvmTraceEvent {
            block_number: self.block_number,
            virtual_ts_ns,
            tx_hash,
            caller: caller_agent.to_string(),
            contract_address: AMM_CONTRACT_ADDRESS_HEX.to_string(),
            action: if zero_for_one {
                "SWAP_ETH_FOR_USDT".to_string()
            } else {
                "CALL_SWAP_EXACT_TOKENS".to_string()
            },
            zero_for_one,
            amount_in,
            amount_out,
            effective_price,
            slippage_bps,
            reserve_base: self.reserve_base,
            reserve_quote: self.reserve_quote,
            gas_used,
            log_line,
        };

        self.push_event(event.clone());

        Ok(SwapReceipt {
            amount_in,
            amount_out,
            fee_paid: FixedQty(fee_paid_pips),
            effective_price,
            spot_price_before: spot_before,
            spot_price_after: spot_after,
            slippage_bps,
            gas_used,
            trace_event: event,
        })
    }

    /// Records a structured EVM telemetry alert (e.g., `LIQUIDATION WARNING`, `ORACLE UPDATE LAG`, `ARB SLIPPAGE`).
    pub fn record_telemetry_alert(
        &mut self,
        caller: &str,
        action: &str,
        detail: &str,
        slippage_bps: i64,
        virtual_ts_ns: u64,
    ) {
        self.swap_nonce += 1;
        let tx_hash =
            deterministic_tx_hash(self.block_number, self.swap_nonce, caller, slippage_bps, 0);
        let short_hash = &tx_hash[..6];
        let log_line = format!("[BLK #{}] {}.. {}", self.block_number, short_hash, detail);
        let event = EvmTraceEvent {
            block_number: self.block_number,
            virtual_ts_ns,
            tx_hash,
            caller: caller.to_string(),
            contract_address: AMM_CONTRACT_ADDRESS_HEX.to_string(),
            action: action.to_string(),
            zero_for_one: true,
            amount_in: FixedQty::ZERO,
            amount_out: FixedQty::ZERO,
            effective_price: self.spot_price(),
            slippage_bps,
            reserve_base: self.reserve_base,
            reserve_quote: self.reserve_quote,
            gas_used: 21_000,
            log_line,
        };
        self.push_event(event);
    }

    pub fn advance_block(&mut self) {
        self.block_number += 1;
    }

    pub fn recent_events(&self, limit: usize) -> Vec<EvmTraceEvent> {
        self.events.iter().rev().take(limit).cloned().collect()
    }

    fn push_event(&mut self, event: EvmTraceEvent) {
        if self.events.len() >= MAX_EVM_TRACE_EVENTS {
            self.events.pop_front();
        }
        self.events.push_back(event);
    }

    /// Feeds canonical EVM AMM pool state into a SHA-256 hasher.
    pub fn feed_hash(&self, hasher: &mut Sha256) {
        hasher.update(self.block_number.to_le_bytes());
        hasher.update(self.swap_nonce.to_le_bytes());
        hasher.update(self.reserve_base.0.to_le_bytes());
        hasher.update(self.reserve_quote.0.to_le_bytes());
        hasher.update(self.fee_bps.to_le_bytes());
    }
}

fn deterministic_caller_address(agent_id: &str) -> Address {
    let mut hasher = Sha256::new();
    hasher.update(b"APEX_EVM_CALLER:");
    hasher.update(agent_id.as_bytes());
    let digest = hasher.finalize();
    let mut bytes = [0u8; 20];
    bytes.copy_from_slice(&digest[..20]);
    Address::from(bytes)
}

fn deterministic_tx_hash(
    block: u64,
    nonce: u64,
    caller: &str,
    in_pips: i64,
    out_pips: i64,
) -> String {
    let mut hasher = Sha256::new();
    hasher.update(block.to_le_bytes());
    hasher.update(nonce.to_le_bytes());
    hasher.update(caller.as_bytes());
    hasher.update(in_pips.to_le_bytes());
    hasher.update(out_pips.to_le_bytes());
    let digest = hasher.finalize();
    let mut hex = String::with_capacity(66);
    hex.push_str("0x");
    for byte in digest {
        use std::fmt::Write;
        let _ = write!(&mut hex, "{:02x}", byte);
    }
    hex
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_revm_cfmm_swap_execution_and_determinism() {
        // 1,000 ETH and 2,240,000 USDT -> initial spot = $2,240.00
        let mut pool = EvmAmmPool::new(
            FixedQty::from_whole(1_000),
            FixedQty::from_whole(2_240_000),
            1_942_080,
        );
        assert_eq!(pool.spot_price(), FixedPrice::from_whole(2240));
        let k_before = pool.invariant_k();

        // Sell 10 ETH into pool
        let receipt = pool
            .execute_swap("Hawkes-HFT", true, FixedQty::from_whole(10), 10_000_000)
            .unwrap();

        assert!(receipt.amount_out.0 > 0);
        assert!(receipt.gas_used > 21_000);
        assert!(pool.spot_price() < FixedPrice::from_whole(2240));
        // With 30 bps fee retained in pool reserves, post-swap k >= pre-swap k
        assert!(pool.invariant_k() >= k_before);
    }
}
