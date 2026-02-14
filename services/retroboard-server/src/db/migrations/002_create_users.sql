-- Migration: 002_create_users
-- Description: Create the users table for authentication
-- Created: 2026-02-14

CREATE TABLE IF NOT EXISTS users (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255)    NOT NULL,
    password_hash   VARCHAR(60)     NOT NULL,
    display_name    VARCHAR(50)     NOT NULL,
    avatar_url      VARCHAR(500),
    email_verified  BOOLEAN         NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT users_email_key UNIQUE (email)
);

COMMENT ON TABLE users IS 'Registered user accounts for RetroBoard Pro';
COMMENT ON COLUMN users.email IS 'User email address, stored lowercase';
COMMENT ON COLUMN users.password_hash IS 'bcrypt hash with cost factor 12';
COMMENT ON COLUMN users.display_name IS 'Display name shown in the UI';
COMMENT ON COLUMN users.avatar_url IS 'Optional URL to user avatar image';
