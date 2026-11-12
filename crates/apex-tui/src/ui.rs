//! Obsidian Microstructure 4-Quadrant Terminal UI Renderer (`ratatui`).

use apex_kernel::{scoring::format_equity_dollars, ArenaKernel};
use apex_types::{AgentStatus, MarketRegime, SCALE};
use ratatui::{
    layout::{Constraint, Direction, Layout, Rect},
    style::{Color, Modifier, Style},
    symbols,
    text::{Line, Span},
    widgets::{
        Axis, Block, Borders, Cell, Chart, Dataset, GraphType, List, ListItem, Paragraph, Row,
        Table,
    },
    Frame,
};

// Obsidian Microstructure Palette
const BG_VOID: Color = Color::Rgb(5, 5, 5);
const BG_PANEL: Color = Color::Rgb(11, 12, 16);
const BORDER_GRID: Color = Color::Rgb(28, 32, 43);
const TEXT_PRIMARY: Color = Color::Rgb(243, 244, 246);
const TEXT_SECONDARY: Color = Color::Rgb(156, 163, 175);
const TEXT_MUTED: Color = Color::Rgb(75, 85, 99);
const COLOR_BID: Color = Color::Rgb(0, 245, 155);
const COLOR_ASK: Color = Color::Rgb(255, 46, 84);
const COLOR_EVM: Color = Color::Rgb(56, 189, 248);
const COLOR_CHAOS: Color = Color::Rgb(245, 158, 11);
const COLOR_LLM: Color = Color::Rgb(168, 85, 247);

pub struct UiViewState {
    pub paused: bool,
    pub swap_bottom_panes: bool,
    pub determinism_banner: Option<String>,
}

pub fn render_workstation_frame(
    f: &mut Frame,
    kernel: &ArenaKernel,
    view: &UiViewState,
) {
    let area = f.area();
    f.render_widget(Block::default().style(Style::default().bg(BG_VOID)), area);

    let root_chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([
            Constraint::Length(3), // Top Ribbon
            Constraint::Min(16),   // 4-Quadrant Grid
            Constraint::Length(2), // Controls & Determinism Status Bar
        ])
        .split(area);

    render_top_ribbon(f, root_chunks[0], kernel, view);

    let main_rows = Layout::default()
        .direction(Direction::Vertical)
        .constraints([Constraint::Percentage(50), Constraint::Percentage(50)])
        .split(root_chunks[1]);

    let top_cols = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([Constraint::Percentage(48), Constraint::Percentage(52)])
        .split(main_rows[0]);

    let bottom_cols = Layout::default()
        .direction(Direction::Horizontal)
        .constraints([Constraint::Percentage(48), Constraint::Percentage(52)])
        .split(main_rows[1]);

    // Quadrant 1 (Top-Left): L2/L3 Order Book Depth
    render_order_book_quadrant(f, top_cols[0], kernel);

    // Quadrant 3 (Top-Right): Multi-Agent Price & Drawdown Braille Chart
    render_price_chart_quadrant(f, top_cols[1], kernel);

    if view.swap_bottom_panes {
        render_leaderboard_quadrant(f, bottom_cols[0], kernel);
        render_evm_telemetry_quadrant(f, bottom_cols[1], kernel);
    } else {
        render_evm_telemetry_quadrant(f, bottom_cols[0], kernel);
        render_leaderboard_quadrant(f, bottom_cols[1], kernel);
    }

    render_footer_bar(f, root_chunks[2], kernel, view);
}

fn render_top_ribbon(f: &mut Frame, area: Rect, kernel: &ArenaKernel, view: &UiViewState) {
    let snap = kernel.telemetry_snapshot(5);
    let regime_color = match snap.regime {
        MarketRegime::Calm => COLOR_BID,
        MarketRegime::Trending => COLOR_EVM,
        MarketRegime::LiquidityDrought => COLOR_CHAOS,
        MarketRegime::FlashCrash => COLOR_ASK,
    };

    let state_short = &snap.state_hash[..12];
    let pause_badge = if view.paused { " [PAUSED] " } else { "" };

    let ribbon_line = Line::from(vec![
        Span::styled(
            " [APEX-ARENA v1.0] ",
            Style::default()
                .fg( BG_VOID )
                .bg(COLOR_EVM)
                .add_modifier(Modifier::BOLD),
        ),
        Span::styled(
            pause_badge,
            Style::default()
                .fg(BG_VOID)
                .bg(COLOR_CHAOS)
                .add_modifier(Modifier::BOLD),
        ),
        Span::styled(
            format!(" TICK: {:06} ", snap.tick),
            Style::default().fg(TEXT_PRIMARY).add_modifier(Modifier::BOLD),
        ),
        Span::styled("|", Style::default().fg(TEXT_MUTED)),
        Span::styled(
            format!(" BLK: #{} ", snap.block_number),
            Style::default().fg(COLOR_EVM),
        ),
        Span::styled("|", Style::default().fg(TEXT_MUTED)),
        Span::styled(
            format!(" MID: {} ", snap.clob_mid_price.format_dollars()),
            Style::default().fg(TEXT_PRIMARY).add_modifier(Modifier::BOLD),
        ),
        Span::styled("|", Style::default().fg(TEXT_MUTED)),
        Span::styled(
            format!(" REVM: {} ", snap.evm_spot_price.format_dollars()),
            Style::default().fg(COLOR_EVM),
        ),
        Span::styled("|", Style::default().fg(TEXT_MUTED)),
        Span::styled(" REGIME: ", Style::default().fg(TEXT_SECONDARY)),
        Span::styled(
            format!(" {} ", snap.regime.as_str()),
            Style::default()
                .fg(BG_VOID)
                .bg(regime_color)
                .add_modifier(Modifier::BOLD),
        ),
        Span::styled(
            format!("  SHA256:{}", state_short),
            Style::default().fg(TEXT_MUTED),
        ),
    ]);

    let block = Block::default()
        .borders(Borders::ALL)
        .border_style(Style::default().fg(BORDER_GRID))
        .style(Style::default().bg(BG_PANEL));

    f.render_widget(Paragraph::new(ribbon_line).block(block), area);
}

fn render_order_book_quadrant(f: &mut Frame, area: Rect, kernel: &ArenaKernel) {
    let snap = kernel.clob().top_levels(5);
    let max_vol = snap
        .asks
        .iter()
        .chain(snap.bids.iter())
        .map(|l| l.total_qty.0)
        .max()
        .unwrap_or(SCALE)
        .max(1);

    let mut lines = Vec::with_capacity(14);

    // Asks displayed highest to lowest so lowest ask is right above the spread divider
    for ask in snap.asks.iter().rev() {
        let bar_len = (((ask.total_qty.0 as i128) * 14) / (max_vol as i128)).clamp(1, 14) as usize;
        let bar = "█".repeat(bar_len);
        lines.push(Line::from(vec![
            Span::styled(" ASK  ", Style::default().fg(COLOR_ASK).add_modifier(Modifier::BOLD)),
            Span::styled(
                format!("{:>10}  ", ask.price.format_dollars()),
                Style::default().fg(TEXT_PRIMARY),
            ),
            Span::styled(
                format!("{:>6} ETH  ", ask.total_qty.format_2dp()),
                Style::default().fg(TEXT_SECONDARY),
            ),
            Span::styled(bar, Style::default().fg(COLOR_ASK)),
        ]));
    }

    lines.push(Line::from(Span::styled(
        " ──────────────────────────────────────────────",
        Style::default().fg(BORDER_GRID),
    )));
    lines.push(Line::from(vec![
        Span::styled(" SPREAD: ", Style::default().fg(TEXT_SECONDARY)),
        Span::styled(
            format!("{} bps", snap.spread_bps),
            Style::default().fg(COLOR_CHAOS).add_modifier(Modifier::BOLD),
        ),
        Span::styled(
            format!("   (IMB: {:+} bps)", kernel.clob().order_book_imbalance_bps(5)),
            Style::default().fg(TEXT_MUTED),
        ),
    ]));
    lines.push(Line::from(Span::styled(
        " ──────────────────────────────────────────────",
        Style::default().fg(BORDER_GRID),
    )));

    for bid in &snap.bids {
        let bar_len = (((bid.total_qty.0 as i128) * 14) / (max_vol as i128)).clamp(1, 14) as usize;
        let bar = "█".repeat(bar_len);
        lines.push(Line::from(vec![
            Span::styled(" BID  ", Style::default().fg(COLOR_BID).add_modifier(Modifier::BOLD)),
            Span::styled(
                format!("{:>10}  ", bid.price.format_dollars()),
                Style::default().fg(TEXT_PRIMARY),
            ),
            Span::styled(
                format!("{:>6} ETH  ", bid.total_qty.format_2dp()),
                Style::default().fg(TEXT_SECONDARY),
            ),
            Span::styled(bar, Style::default().fg(COLOR_BID)),
        ]));
    }

    let block = Block::default()
        .title(Span::styled(
            " QUADRANT 1: L2/L3 ORDER BOOK DEPTH (STP: CANCEL-NEWEST) ",
            Style::default().fg(TEXT_PRIMARY).add_modifier(Modifier::BOLD),
        ))
        .borders(Borders::ALL)
        .border_style(Style::default().fg(BORDER_GRID))
        .style(Style::default().bg(BG_PANEL));

    f.render_widget(Paragraph::new(lines).block(block), area);
}

fn render_price_chart_quadrant(f: &mut Frame, area: Rect, kernel: &ArenaKernel) {
    let history = kernel.price_history();
    let clob_points: Vec<(f64, f64)> = history
        .iter()
        .map(|(t, clob, _, _)| (*t as f64, (clob.0 as f64) / (SCALE as f64)))
        .collect();
    let evm_points: Vec<(f64, f64)> = history
        .iter()
        .map(|(t, _, evm, _)| (*t as f64, (evm.0 as f64) / (SCALE as f64)))
        .collect();

    let (x_min, x_max) = match (history.front(), history.back()) {
        (Some(first), Some(last)) if last.0 > first.0 => (first.0 as f64, last.0 as f64),
        _ => (0.0, 100.0),
    };

    let mut y_min = 2180.0_f64;
    let mut y_max = 2280.0_f64;
    if !clob_points.is_empty() {
        let min_p = clob_points
            .iter()
            .chain(evm_points.iter())
            .map(|(_, y)| *y)
            .fold(f64::INFINITY, f64::min);
        let max_p = clob_points
            .iter()
            .chain(evm_points.iter())
            .map(|(_, y)| *y)
            .fold(f64::NEG_INFINITY, f64::max);
        y_min = (min_p - 6.0).floor();
        y_max = (max_p + 6.0).ceil();
    }

    let datasets = vec![
        Dataset::default()
            .name("CLOB Mid")
            .marker(symbols::Marker::Braille)
            .graph_type(GraphType::Line)
            .style(Style::default().fg(COLOR_BID))
            .data(&clob_points),
        Dataset::default()
            .name("Revm Pool")
            .marker(symbols::Marker::Braille)
            .graph_type(GraphType::Line)
            .style(Style::default().fg(COLOR_EVM))
            .data(&evm_points),
    ];

    let title = if kernel.regime().is_ood() {
        format!(
            " QUADRANT 3: MULTI-AGENT PRICE & DRAWDOWN [CHAOS EVENT: {}] ",
            kernel.regime().as_str()
        )
    } else {
        " QUADRANT 3: MULTI-AGENT PRICE & DRAWDOWN (CLOB vs REVM) ".to_string()
    };

    let title_color = if kernel.regime().is_ood() {
        COLOR_CHAOS
    } else {
        TEXT_PRIMARY
    };

    let chart = Chart::new(datasets)
        .block(
            Block::default()
                .title(Span::styled(
                    title,
                    Style::default().fg(title_color).add_modifier(Modifier::BOLD),
                ))
                .borders(Borders::ALL)
                .border_style(Style::default().fg(BORDER_GRID))
                .style(Style::default().bg(BG_PANEL)),
        )
        .x_axis(
            Axis::default()
                .title(Span::styled("Ticks", Style::default().fg(TEXT_SECONDARY)))
                .style(Style::default().fg(TEXT_MUTED))
                .bounds([x_min, x_max])
                .labels(vec![
                    Span::raw(format!("{:.0}", x_min)),
                    Span::raw(format!("{:.0}", (x_min + x_max) / 2.0)),
                    Span::raw(format!("{:.0}", x_max)),
                ]),
        )
        .y_axis(
            Axis::default()
                .title(Span::styled("USD", Style::default().fg(TEXT_SECONDARY)))
                .style(Style::default().fg(TEXT_MUTED))
                .bounds([y_min, y_max])
                .labels(vec![
                    Span::raw(format!("${:.0}", y_min)),
                    Span::raw(format!("${:.0}", (y_min + y_max) / 2.0)),
                    Span::raw(format!("${:.0}", y_max)),
                ]),
        );

    f.render_widget(chart, area);
}

fn render_evm_telemetry_quadrant(f: &mut Frame, area: Rect, kernel: &ArenaKernel) {
    let events = kernel.evm_pool().recent_events(12);
    let items: Vec<ListItem> = events
        .into_iter()
        .map(|ev| {
            let color = if ev.action.contains("LIQUIDATION") {
                COLOR_ASK
            } else if ev.action.contains("ORACLE") || ev.action.contains("FLASH_CRASH") {
                COLOR_CHAOS
            } else {
                COLOR_EVM
            };
            ListItem::new(Line::from(Span::styled(
                format!(" {}", ev.log_line),
                Style::default().fg(color),
            )))
        })
        .collect();

    let block = Block::default()
        .title(Span::styled(
            " QUADRANT 2: REVM & CONTRACT TELEMETRY (IN-MEMORY CACHEDB) ",
            Style::default().fg(COLOR_EVM).add_modifier(Modifier::BOLD),
        ))
        .borders(Borders::ALL)
        .border_style(Style::default().fg(BORDER_GRID))
        .style(Style::default().bg(BG_PANEL));

    f.render_widget(List::new(items).block(block), area);
}

fn render_leaderboard_quadrant(f: &mut Frame, area: Rect, kernel: &ArenaKernel) {
    let chunks = Layout::default()
        .direction(Direction::Vertical)
        .constraints([Constraint::Min(7), Constraint::Length(5)])
        .split(area);

    let board = kernel.leaderboard();
    let header = Row::new(vec![
        Cell::from(" AGENT"),
        Cell::from("EQUITY"),
        Cell::from("PNL"),
        Cell::from("MAX DD"),
        Cell::from("ACS"),
        Cell::from("STAT"),
    ])
    .style(
        Style::default()
            .fg(TEXT_SECONDARY)
            .add_modifier(Modifier::BOLD),
    );

    let rows: Vec<Row> = board
        .into_iter()
        .map(|r| {
            let pnl_sign = if r.pnl_bps >= 0 { "+" } else { "" };
            let pnl_color = if r.pnl_bps >= 0 { COLOR_BID } else { COLOR_ASK };
            let stat_color = match r.status {
                AgentStatus::Active => COLOR_BID,
                AgentStatus::Liquidated => COLOR_ASK,
            };
            Row::new(vec![
                Cell::from(format!(" {} {}", r.kind.badge(), r.agent_id))
                    .style(Style::default().fg(TEXT_PRIMARY)),
                Cell::from(format_equity_dollars(r.current_equity_pips))
                    .style(Style::default().fg(TEXT_PRIMARY)),
                Cell::from(format!(
                    "{}{}.{:01}%",
                    pnl_sign,
                    r.pnl_bps / 100,
                    (r.pnl_bps.abs() % 100) / 10
                ))
                .style(Style::default().fg(pnl_color).add_modifier(Modifier::BOLD)),
                Cell::from(format!(
                    "{}.{:01}%",
                    r.max_drawdown_bps / 100,
                    (r.max_drawdown_bps % 100) / 10
                ))
                .style(Style::default().fg(TEXT_SECONDARY)),
                Cell::from(format!(
                    "{}.{:01}",
                    r.acs_score_bps / 100,
                    (r.acs_score_bps % 100) / 10
                ))
                .style(Style::default().fg(COLOR_EVM)),
                Cell::from(r.status.as_str())
                    .style(Style::default().fg(stat_color).add_modifier(Modifier::BOLD)),
            ])
        })
        .collect();

    let table = Table::new(
        rows,
        [
            Constraint::Length(17),
            Constraint::Length(10),
            Constraint::Length(8),
            Constraint::Length(8),
            Constraint::Length(7),
            Constraint::Length(5),
        ],
    )
    .header(header)
    .block(
        Block::default()
            .title(Span::styled(
                " QUADRANT 4: LIVE LEADERBOARD & MACRO LLM REASONING ",
                Style::default().fg(TEXT_PRIMARY).add_modifier(Modifier::BOLD),
            ))
            .borders(Borders::TOP | Borders::LEFT | Borders::RIGHT)
            .border_style(Style::default().fg(BORDER_GRID))
            .style(Style::default().bg(BG_PANEL)),
    );

    f.render_widget(table, chunks[0]);

    let snap = kernel.telemetry_snapshot(1);
    let mut trace_lines = Vec::with_capacity(3);
    for tr in snap.recent_reasoning.iter().take(2) {
        trace_lines.push(Line::from(vec![
            Span::styled(
                format!(" [MCP:{}] ", tr.agent_id),
                Style::default().fg(COLOR_LLM).add_modifier(Modifier::BOLD),
            ),
            Span::styled(
                tr.thought_summary.clone(),
                Style::default().fg(TEXT_SECONDARY),
            ),
        ]));
    }

    let trace_block = Block::default()
        .borders(Borders::BOTTOM | Borders::LEFT | Borders::RIGHT)
        .border_style(Style::default().fg(BORDER_GRID))
        .style(Style::default().bg(BG_PANEL));

    f.render_widget(Paragraph::new(trace_lines).block(trace_block), chunks[1]);
}

fn render_footer_bar(f: &mut Frame, area: Rect, _kernel: &ArenaKernel, view: &UiViewState) {
    let status_msg = view
        .determinism_banner
        .as_deref()
        .unwrap_or("Ready | Bit-for-Bit Fixed-Point Mode (SCALE=10^8)");

    let line = Line::from(vec![
        Span::styled(
            " [SPACE] Pause/Resume  [C] Trigger Flash Crash  [D] 5-Run SHA256 Check  [L] Swap Bottom Panes  [R] Reset  [Q] Quit ",
            Style::default().fg(TEXT_SECONDARY),
        ),
        Span::styled(" | ", Style::default().fg(TEXT_MUTED)),
        Span::styled(status_msg, Style::default().fg(COLOR_BID)),
    ]);

    f.render_widget(
        Paragraph::new(line).style(Style::default().bg(BG_PANEL)),
        area,
    );
}
