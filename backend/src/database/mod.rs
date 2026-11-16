use sqlx::{postgres::PgPoolOptions, PgPool};
use std::time::Duration;

pub async fn create_pool(database_url: &str) -> Result<PgPool, sqlx::Error> {
    let pool = PgPoolOptions::new()
        .max_connections(25)
        .min_connections(2)
        .acquire_timeout(Duration::from_secs(15))
        .connect(database_url)
        .await?;

    // Run NEOCRA schema migrations (only touches schema `neocra`)
    sqlx::migrate!("./migrations").run(&pool).await?;

    Ok(pool)
}
