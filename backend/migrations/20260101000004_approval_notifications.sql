-- NEOCRA Approval Notification System
-- Strictly isolated in schema `neocra`. Legacy tables are never altered.

CREATE TABLE IF NOT EXISTS neocra.approval_rules (
    id BIGSERIAL PRIMARY KEY,
    module VARCHAR(40) NOT NULL,
    stage VARCHAR(40) NOT NULL,
    target_type VARCHAR(30) NOT NULL,
    target_value VARCHAR(100),
    branch_code VARCHAR(20),
    min_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
    max_amount NUMERIC(18,2),
    notify_in_app BOOLEAN NOT NULL DEFAULT TRUE,
    notify_whatsapp BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_neocra_approval_rules_lookup
    ON neocra.approval_rules (module, stage, is_active);

CREATE TABLE IF NOT EXISTS neocra.notifications (
    id UUID PRIMARY KEY,
    recipient_username VARCHAR(100) NOT NULL,
    event_id UUID REFERENCES neocra.outbox_events(id) ON DELETE SET NULL,
    category VARCHAR(40) NOT NULL,
    module VARCHAR(40) NOT NULL,
    stage VARCHAR(40),
    entity_type VARCHAR(60) NOT NULL,
    entity_id VARCHAR(100) NOT NULL,
    document_number VARCHAR(100) NOT NULL,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    action_url VARCHAR(255) NOT NULL,
    actor_username VARCHAR(100),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    read_at TIMESTAMP WITHOUT TIME ZONE,
    action_taken_at TIMESTAMP WITHOUT TIME ZONE,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_neocra_notif_recipient_unread
    ON neocra.notifications (recipient_username, is_read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_neocra_notif_entity_stage
    ON neocra.notifications (entity_type, entity_id, stage)
    WHERE action_taken_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_neocra_notif_event_recipient
    ON neocra.notifications (event_id, recipient_username)
    WHERE event_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS neocra.user_notification_prefs (
    username VARCHAR(100) PRIMARY KEY,
    in_app_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    whatsapp_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    email_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    whatsapp_override VARCHAR(30),
    quiet_hours_start TIME,
    quiet_hours_end TIME,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS neocra.notification_deliveries (
    id BIGSERIAL PRIMARY KEY,
    notification_id UUID NOT NULL REFERENCES neocra.notifications(id) ON DELETE CASCADE,
    channel VARCHAR(20) NOT NULL,
    destination VARCHAR(120) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    attempts INT NOT NULL DEFAULT 0,
    last_error TEXT,
    sent_at TIMESTAMP WITHOUT TIME ZONE,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE (notification_id, channel)
);

-- Seed default approval routing rules (idempotent: only when table is empty)
INSERT INTO neocra.approval_rules (module, stage, target_type, target_value, notify_in_app, notify_whatsapp)
SELECT v.module, v.stage, v.target_type, v.target_value, v.notify_in_app, v.notify_whatsapp
FROM (VALUES
    ('purchasing.pp', 'spv',             'direct_supervisor', NULL,                TRUE, FALSE),
    ('purchasing.pp', 'whm',             'jabatan',           '13',                TRUE, FALSE),
    ('purchasing.pp', 'gm',              'jabatan',           '3',                 TRUE, FALSE),
    ('purchasing.pp', 'gm',              'jabatan',           '1',                 TRUE, FALSE),
    ('purchasing.pp', 'gm',              'jabatan',           '2',                 TRUE, FALSE),
    ('purchasing.pp', 'purchasing_team', 'role',              'ROLE_PO',           TRUE, FALSE),
    ('purchasing.po', 'check1',          'jabatan',           '3',                 TRUE, FALSE),
    ('purchasing.po', 'check1',          'jabatan',           '11',                TRUE, FALSE),
    ('purchasing.po', 'director',        'jabatan',           '1',                 TRUE, FALSE),
    ('purchasing.po', 'director',        'jabatan',           '2',                 TRUE, FALSE),
    ('purchasing.po', 'warehouse',       'role',              'ROLE_PENERIMAANPO', TRUE, FALSE),
    ('sales.so',      'warehouse',       'role',              'ROLE_SOGUDANG',     TRUE, FALSE)
) AS v(module, stage, target_type, target_value, notify_in_app, notify_whatsapp)
WHERE NOT EXISTS (SELECT 1 FROM neocra.approval_rules LIMIT 1);
