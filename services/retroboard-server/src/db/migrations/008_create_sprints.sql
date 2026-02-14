-- Migration: 008_create_sprints
-- Description: Create the sprints table with status enum and one-active-per-team constraint
-- Created: 2026-02-14

CREATE TYPE sprint_status AS ENUM ('planning', 'active', 'completed');

CREATE TABLE IF NOT EXISTS sprints (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id         UUID            NOT NULL,
    name            VARCHAR(100)    NOT NULL,
    goal            VARCHAR(500),
    start_date      DATE            NOT NULL,
    end_date        DATE,
    status          sprint_status   NOT NULL DEFAULT 'planning',
    sprint_number   INTEGER         NOT NULL,
    created_by      UUID            NOT NULL,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT sprints_team_id_fkey
        FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    CONSTRAINT sprints_created_by_fkey
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
    CONSTRAINT sprints_end_date_check
        CHECK (end_date IS NULL OR end_date >= start_date),
    CONSTRAINT sprints_team_sprint_number_key
        UNIQUE (team_id, sprint_number)
);

-- Composite index for listing sprints by team and filtering by status
CREATE INDEX IF NOT EXISTS sprints_team_id_status_idx
    ON sprints (team_id, status);

-- Index for paginated listing sorted by start_date descending
CREATE INDEX IF NOT EXISTS sprints_team_id_start_date_idx
    ON sprints (team_id, start_date DESC);

-- Partial unique index: only one active sprint per team
CREATE UNIQUE INDEX IF NOT EXISTS sprints_team_active_idx
    ON sprints (team_id) WHERE status = 'active';

COMMENT ON TABLE sprints IS 'Time-boxed iterations that contain retro boards';
COMMENT ON COLUMN sprints.status IS 'Lifecycle: planning -> active -> completed';
COMMENT ON COLUMN sprints.sprint_number IS 'Auto-incremented sprint number within a team (not a DB sequence)';
COMMENT ON COLUMN sprints.start_date IS 'Sprint start date (calendar date, no time)';
COMMENT ON COLUMN sprints.end_date IS 'Sprint end date. NULL for open-ended sprints.';
COMMENT ON INDEX sprints_team_active_idx IS 'Enforces at most one active sprint per team';
