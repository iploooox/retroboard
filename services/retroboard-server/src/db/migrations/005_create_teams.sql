-- Migration: 005_create_teams
-- Description: Create the teams table and team_role enum
-- Created: 2026-02-14

CREATE TYPE team_role AS ENUM ('admin', 'facilitator', 'member');

CREATE TABLE IF NOT EXISTS teams (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(100)    NOT NULL,
    slug            VARCHAR(60)     NOT NULL,
    description     VARCHAR(500),
    avatar_url      VARCHAR(500),
    created_by      UUID            NOT NULL,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ,

    CONSTRAINT teams_slug_key UNIQUE (slug),
    CONSTRAINT teams_created_by_fkey
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS teams_created_by_idx
    ON teams (created_by);

COMMENT ON TABLE teams IS 'Teams that organize retro boards and sprints';
COMMENT ON COLUMN teams.slug IS 'URL-friendly unique identifier, generated from name';
COMMENT ON COLUMN teams.created_by IS 'User who created the team (initial admin)';
