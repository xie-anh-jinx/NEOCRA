use std::path::PathBuf;
use tracing_appender::non_blocking::WorkerGuard;
use tracing_subscriber::{fmt, layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

pub fn init_logging(app_dir: &PathBuf) -> WorkerGuard {
    let log_dir = app_dir.join("logs");
    let _ = std::fs::create_dir_all(&log_dir);
    let file_appender = tracing_appender::rolling::daily(log_dir, "neocra.log");
    let (non_blocking, guard) = tracing_appender::non_blocking(file_appender);

    let filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("info,neocra_desktop=debug"));

    let _ = tracing_subscriber::registry()
        .with(filter)
        .with(fmt::layer().with_writer(non_blocking).with_ansi(false))
        .try_init();

    std::panic::set_hook(Box::new(|panic_info| {
        tracing::error!(panic = %panic_info, "NEOCRA Desktop fatal panic");
    }));

    guard
}
