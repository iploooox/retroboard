-- Migration: 003_create_refresh_tokens
-- Description: Create the refresh_tokens table for JWT refresh token management
-- Created: 2026-02-14

CREATE TABLE IF NOT EXISTS refresh_tokens (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID            NOT NULL,
    token_hash      VARCHAR(64)     NOT NULL,
    expires_at      TIMESTAMPTZ     NOT NULL,
    revoked_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT refresh_tokens_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS refresh_tokens_token_hash_idx
    ON refresh_tokens (token_hash);

CREATE INDEX IF NOT EXISTS refresh_tokens_user_id_idx
    ON refresh_tokens (user_id);

CREATE INDEX IF NOT EXISTS refresh_tokens_expires_at_idx
    ON refresh_tokens (expires_at);

COMMENT ON TABLE refresh_tokens IS 'Hashed refresh tokens for session management';
COMMENT ON COLUMN refresh_tokens.token_hash IS 'SHA-256 hex digest of the raw refresh token';
COMMENT ON COLUMN refresh_tokens.revoked_at IS 'NULL means active; non-NULL means revoked';
