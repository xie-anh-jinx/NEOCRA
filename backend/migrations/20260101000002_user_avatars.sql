CREATE TABLE IF NOT EXISTS neocra.user_avatars (
    username VARCHAR(100) PRIMARY KEY,
    avatar_data TEXT NOT NULL,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);
