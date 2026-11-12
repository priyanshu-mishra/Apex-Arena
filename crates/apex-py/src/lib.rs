//! PyO3 Native Extension Module (`apex_arena._core`) exposing `ArenaKernel` to Python.

use apex_kernel::{verify_multi_run_determinism, ArenaKernel};
use apex_types::{FixedPrice, FixedQty, MarketRegime, OrderId, OrderType, Side};
use pyo3::{exceptions::PyValueError, prelude::*};

fn parse_regime(regime: &str) -> Result<MarketRegime, PyErr> {
    match regime.to_ascii_lowercase().as_str() {
        "calm" => Ok(MarketRegime::Calm),
        "trending" | "trend" => Ok(MarketRegime::Trending),
        "liquidity-drought" | "liquidity_drought" | "drought" => Ok(MarketRegime::LiquidityDrought),
        "flash-crash" | "flash_crash" | "crash" => Ok(MarketRegime::FlashCrash),
        other => Err(PyValueError::new_err(format!(
            "unsupported market regime: {other}"
        ))),
    }
}

fn parse_side(side: &str) -> Result<Side, PyErr> {
    match side.to_ascii_uppercase().as_str() {
        "BID" | "BUY" => Ok(Side::Bid),
        "ASK" | "SELL" => Ok(Side::Ask),
        other => Err(PyValueError::new_err(format!("invalid side: {other}"))),
    }
}

fn parse_order_type(order_type: &str) -> Result<OrderType, PyErr> {
    match order_type.to_ascii_uppercase().as_str() {
        "LIMIT" => Ok(OrderType::Limit),
        "MARKET" => Ok(OrderType::Market),
        "POST_ONLY" | "POSTONLY" => Ok(OrderType::PostOnly),
        "IOC" => Ok(OrderType::IOC),
        other => Err(PyValueError::new_err(format!(
            "invalid order_type: {other}"
        ))),
    }
}

#[pyclass(unsendable)]
pub struct PyArenaKernel {
    inner: ArenaKernel,
}

#[pymethods]
impl PyArenaKernel {
    #[new]
    #[pyo3(signature = (seed = 42, regime = "calm"))]
    pub fn new(seed: u64, regime: &str) -> PyResult<Self> {
        let parsed = parse_regime(regime)?;
        Ok(Self {
            inner: ArenaKernel::new(seed, parsed),
        })
    }

    pub fn tick(&self) -> u64 {
        self.inner.tick()
    }

    pub fn virtual_ts_ns(&self) -> u64 {
        self.inner.virtual_ts_ns()
    }

    pub fn regime(&self) -> String {
        self.inner.regime().as_str().to_string()
    }

    pub fn step(&mut self) -> String {
        self.inner.step_fast_tick();
        self.inner.state_hash()
    }

    pub fn step_n(&mut self, ticks: u64) -> String {
        self.inner.step_n(ticks);
        self.inner.state_hash()
    }

    pub fn trigger_flash_crash(&mut self) {
        self.inner.trigger_flash_crash();
    }

    pub fn set_regime(&mut self, regime: &str) -> PyResult<()> {
        let parsed = parse_regime(regime)?;
        self.inner.set_regime(parsed);
        Ok(())
    }

    pub fn submit_order(
        &mut self,
        agent_id: &str,
        side: &str,
        order_type: &str,
        price_pips: i64,
        qty_pips: i64,
    ) -> PyResult<String> {
        let s = parse_side(side)?;
        let ot = parse_order_type(order_type)?;
        let outcome = self
            .inner
            .submit_external_order(
                agent_id,
                s,
                ot,
                FixedPrice(price_pips),
                FixedQty(qty_pips),
            )
            .map_err(|e| PyValueError::new_err(e.to_string()))?;
        serde_json::to_string(&outcome).map_err(|e| PyValueError::new_err(e.to_string()))
    }

    pub fn cancel_order(&mut self, order_id: u64) -> bool {
        self.inner.cancel_external_order(OrderId(order_id))
    }

    pub fn execute_amm_swap(
        &mut self,
        agent_id: &str,
        zero_for_one: bool,
        amount_in_pips: i64,
    ) -> PyResult<String> {
        let receipt = self
            .inner
            .execute_external_amm_swap(agent_id, zero_for_one, FixedQty(amount_in_pips))
            .map_err(|e| PyValueError::new_err(e.to_string()))?;
        serde_json::to_string(&receipt.trace_event)
            .map_err(|e| PyValueError::new_err(e.to_string()))
    }

    pub fn macro_digest_json(&self) -> PyResult<String> {
        let digest = self.inner.compile_macro_digest();
        serde_json::to_string(&digest).map_err(|e| PyValueError::new_err(e.to_string()))
    }

    pub fn telemetry_json(&self, depth: usize) -> PyResult<String> {
        let snap = self.inner.telemetry_snapshot(depth);
        serde_json::to_string(&snap).map_err(|e| PyValueError::new_err(e.to_string()))
    }

    pub fn leaderboard_json(&self) -> PyResult<String> {
        let board = self.inner.leaderboard();
        serde_json::to_string(&board).map_err(|e| PyValueError::new_err(e.to_string()))
    }

    pub fn state_hash(&self) -> String {
        self.inner.state_hash()
    }
}

#[pyfunction]
#[pyo3(signature = (seed = 42, ticks = 300, runs = 5))]
pub fn py_verify_determinism(seed: u64, ticks: u64, runs: usize) -> (bool, Vec<String>) {
    verify_multi_run_determinism(seed, ticks, runs, Some(ticks / 2))
}

#[pymodule]
fn _core(m: &Bound<'_, PyModule>) -> PyResult<()> {
    m.add_class::<PyArenaKernel>()?;
    m.add_function(wrap_pyfunction!(py_verify_determinism, m)?)?;
    Ok(())
}
