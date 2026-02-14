-- Migration: 007_create_team_invitations
-- Description: Create the team_invitations table for invite links
-- Created: 2026-02-14

CREATE TABLE IF NOT EXISTS team_invitations (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id         UUID            NOT NULL,
    code            VARCHAR(12)     NOT NULL,
    created_by      UUID            NOT NULL,
    expires_at      TIMESTAMPTZ     NOT NULL,
    max_uses        INT,
    role            team_role       NOT NULL DEFAULT 'member',
    use_count       INT             NOT NULL DEFAULT 0,
    revoked_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT team_invitations_code_key UNIQUE (code),
    CONSTRAINT team_invitations_team_id_fkey
        FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    CONSTRAINT team_invitations_created_by_fkey
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT team_invitations_use_count_check
        CHECK (use_count >= 0),
    CONSTRAINT team_invitations_max_uses_check
        CHECK (max_uses IS NULL OR max_uses > 0)
);

CREATE INDEX IF NOT EXISTS team_invitations_team_id_idx
    ON team_invitations (team_id);

COMMENT ON TABLE team_invitations IS 'Shareable invite links for team joining';
COMMENT ON COLUMN team_invitations.code IS '12-character alphanumeric invite code';
COMMENT ON COLUMN team_invitations.max_uses IS 'NULL means unlimited uses';
