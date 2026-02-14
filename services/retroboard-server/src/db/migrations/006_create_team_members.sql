-- Migration: 006_create_team_members
-- Description: Create the team_members join table
-- Created: 2026-02-14

CREATE TABLE IF NOT EXISTS team_members (
    team_id         UUID            NOT NULL,
    user_id         UUID            NOT NULL,
    role            team_role       NOT NULL DEFAULT 'member',
    joined_at       TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT team_members_pkey PRIMARY KEY (team_id, user_id),
    CONSTRAINT team_members_team_id_fkey
        FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    CONSTRAINT team_members_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS team_members_user_id_idx
    ON team_members (user_id);

COMMENT ON TABLE team_members IS 'Team membership with role-based access control';
COMMENT ON COLUMN team_members.role IS 'admin: full control, facilitator: run retros, member: participate';
