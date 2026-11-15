//! ApexArena Workstation Terminal Interface (`apex-tui`).
//!
//! Supports interactive terminal execution as well as `--headless` and `--json` modes
//! for deterministic CI snapshots and Python CLI integration.

mod ui;

use apex_kernel::{verify_multi_run_determinism, ArenaKernel};
use apex_types::MarketRegime;
use crossterm::{
    event::{self, Event, KeyCode, KeyEventKind},
    execute,
    terminal::{disable_raw_mode, enable_raw_mode, EnterAlternateScreen, LeaveAlternateScreen},
};
use ratatui::{backend::CrosstermBackend, backend::TestBackend, Terminal};
use std::{io, time::Duration};
use ui::{render_workstation_frame, UiViewState};

fn parse_regime(s: &str) -> MarketRegime {
    match s.to_ascii_lowercase().as_str() {
        "calm" => MarketRegime::Calm,
        "trending" | "trend" => MarketRegime::Trending,
        "drought" | "liquidity-drought" => MarketRegime::LiquidityDrought,
        "flash-crash" | "flash_crash" | "crash" => MarketRegime::FlashCrash,
        _ => MarketRegime::FlashCrash,
    }
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let args: Vec<String> = std::env::args().collect();
    let mut seed: u64 = 42;
    let mut ticks: u64 = 300;
    let mut regime = MarketRegime::Calm;
    let mut headless = false;
    let mut json_output = false;
    let mut verify_only = false;

    let mut i = 1;
    while i < args.len() {
        match args[i].as_str() {
            "--seed" if i + 1 < args.len() => {
                seed = args[i + 1].parse().unwrap_or(42);
                i += 2;
            }
            "--ticks" if i + 1 < args.len() => {
                ticks = args[i + 1].parse().unwrap_or(300);
                i += 2;
            }
            "--scenario" if i + 1 < args.len() => {
                regime = parse_regime(&args[i + 1]);
                i += 2;
            }
            "--headless" => {
                headless = true;
                i += 1;
            }
            "--json" => {
                json_output = true;
                headless = true;
                i += 1;
            }
            "--verify-determinism" => {
                verify_only = true;
                i += 1;
            }
            _ => {
                i += 1;
            }
        }
    }

    if verify_only {
        let crash_at = ticks / 2;
        let (ok, hashes) = verify_multi_run_determinism(seed, ticks, 5, Some(crash_at));
        // The verify run always starts Calm and injects a flash crash halfway through; it ignores
        // `--scenario`. Say so in the output so the hash is never attributed to another run.
        let payload = serde_json::json!({
            "seed": seed,
            "ticks": ticks,
            "start_regime": "calm",
            "flash_crash_at_tick": crash_at,
            "runs": 5,
            "all_equal": ok,
            "hashes": hashes,
        });
        println!("{}", serde_json::to_string_pretty(&payload)?);
        if !ok {
            std::process::exit(1);
        }
        return Ok(());
    }

    if headless {
        let mut kernel = ArenaKernel::new(seed, regime);
        kernel.step_n(ticks);

        if json_output {
            let snap = kernel.telemetry_snapshot(8);
            println!("{}", serde_json::to_string_pretty(&snap)?);
            return Ok(());
        }

        let backend = TestBackend::new(112, 30);
        let mut terminal = Terminal::new(backend)?;
        let view = UiViewState {
            paused: false,
            swap_bottom_panes: false,
            determinism_banner: Some(format!("SHA-256 Verified: {}", &kernel.state_hash()[..16])),
        };
        terminal.draw(|f| render_workstation_frame(f, &kernel, &view))?;

        let buffer = terminal.backend().buffer();
        for y in 0..buffer.area.height {
            let mut row_str = String::with_capacity(buffer.area.width as usize);
            for x in 0..buffer.area.width {
                row_str.push_str(buffer[(x, y)].symbol());
            }
            println!("{}", row_str.trim_end());
        }
        return Ok(());
    }

    // Interactive Workstation TUI Mode
    enable_raw_mode()?;
    let mut stdout = io::stdout();
    execute!(stdout, EnterAlternateScreen)?;
    let backend = CrosstermBackend::new(stdout);
    let mut terminal = Terminal::new(backend)?;

    let mut kernel = ArenaKernel::new(seed, regime);
    // Warm up initial history so chart is populated on launch
    kernel.step_n(60);

    let mut view = UiViewState {
        paused: false,
        swap_bottom_panes: false,
        determinism_banner: None,
    };

    let res = run_interactive_loop(&mut terminal, &mut kernel, &mut view, seed, regime);

    disable_raw_mode()?;
    execute!(terminal.backend_mut(), LeaveAlternateScreen)?;
    terminal.show_cursor()?;

    res
}

fn run_interactive_loop(
    terminal: &mut Terminal<CrosstermBackend<io::Stdout>>,
    kernel: &mut ArenaKernel,
    view: &mut UiViewState,
    seed: u64,
    initial_regime: MarketRegime,
) -> Result<(), Box<dyn std::error::Error>> {
    loop {
        if !view.paused {
            kernel.step_n(2);
        }

        terminal.draw(|f| render_workstation_frame(f, kernel, view))?;

        if event::poll(Duration::from_millis(45))? {
            if let Event::Key(key) = event::read()? {
                if key.kind == KeyEventKind::Press {
                    match key.code {
                        KeyCode::Char('q') | KeyCode::Esc => break,
                        KeyCode::Char(' ') => {
                            view.paused = !view.paused;
                        }
                        KeyCode::Char('c') | KeyCode::Char('C') => {
                            kernel.trigger_flash_crash();
                            view.determinism_banner =
                                Some("FLASH CRASH INJECTED -> Hawkes Panic Active".to_string());
                        }
                        KeyCode::Char('d') | KeyCode::Char('D') => {
                            let (ok, hashes) = verify_multi_run_determinism(seed, 200, 5, Some(100));
                            view.determinism_banner = Some(format!(
                                "5-Run SHA256 Equal={} ({})",
                                ok,
                                &hashes[0][..16]
                            ));
                        }
                        KeyCode::Char('l') | KeyCode::Char('L') => {
                            view.swap_bottom_panes = !view.swap_bottom_panes;
                        }
                        KeyCode::Char('r') | KeyCode::Char('R') => {
                            *kernel = ArenaKernel::new(seed, initial_regime);
                            kernel.step_n(60);
                            view.determinism_banner = Some("Simulation Reset to Seed".to_string());
                        }
                        _ => {}
                    }
                }
            }
        }
    }
    Ok(())
}
