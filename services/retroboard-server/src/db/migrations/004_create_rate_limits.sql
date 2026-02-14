-- Migration: 004_create_rate_limits
-- Description: Create the rate_limits table for auth endpoint rate limiting
-- Created: 2026-02-14

CREATE TABLE IF NOT EXISTS rate_limits (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    key             VARCHAR(255)    NOT NULL,
    window_start    TIMESTAMPTZ     NOT NULL,
    count           INTEGER         NOT NULL DEFAULT 1,

    CONSTRAINT rate_limits_key_window_start_key UNIQUE (key, window_start)
);

CREATE INDEX IF NOT EXISTS rate_limits_key_window_start_idx
    ON rate_limits (key, window_start);

COMMENT ON TABLE rate_limits IS 'Sliding window counters for auth rate limiting';
COMMENT ON COLUMN rate_limits.key IS 'Rate limit key, e.g. login:email:alice@example.com';
COMMENT ON COLUMN rate_limits.window_start IS 'Start of the rate limit window';
