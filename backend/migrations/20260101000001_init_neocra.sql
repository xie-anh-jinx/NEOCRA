-- NEOCRA Platform Schema & Tables
-- Legacy tables in public, finance, and hr schemas are NEVER altered.

CREATE SCHEMA IF NOT EXISTS neocra;

CREATE TABLE IF NOT EXISTS neocra.user_credentials (
    username VARCHAR(100) PRIMARY KEY,
    password_hash TEXT NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS neocra.audit_log (
    id BIGSERIAL PRIMARY KEY,
    occurred_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    username VARCHAR(100),
    action VARCHAR(100) NOT NULL,
    entity VARCHAR(100) NOT NULL,
    entity_id VARCHAR(100),
    payload JSONB,
    ip VARCHAR(64)
);

CREATE INDEX IF NOT EXISTS idx_neocra_audit_log_occurred_at ON neocra.audit_log (occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_neocra_audit_log_username ON neocra.audit_log (username);

CREATE TABLE IF NOT EXISTS neocra.outbox_events (
    id UUID PRIMARY KEY,
    occurred_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    event_type VARCHAR(120) NOT NULL,
    aggregate VARCHAR(80) NOT NULL,
    aggregate_id VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    published_at TIMESTAMP WITHOUT TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_neocra_outbox_unpublished ON neocra.outbox_events (occurred_at) WHERE published_at IS NULL;

CREATE TABLE IF NOT EXISTS neocra.app_settings (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);
