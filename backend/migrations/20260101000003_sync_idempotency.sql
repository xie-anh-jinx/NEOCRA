CREATE TABLE IF NOT EXISTS neocra.sync_idempotency (
    idempotency_key VARCHAR(120) PRIMARY KEY,
    username VARCHAR(100) NOT NULL,
    entity VARCHAR(100) NOT NULL,
    method VARCHAR(16) NOT NULL,
    path TEXT NOT NULL,
    response_status INT NOT NULL,
    response_body JSONB NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_neocra_sync_idempotency_created
    ON neocra.sync_idempotency (created_at DESC);
