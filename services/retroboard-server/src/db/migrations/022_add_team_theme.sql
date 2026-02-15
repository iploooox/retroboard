-- Migration: 022_add_team_theme
-- Description: Add theme column to teams table for customizable visual themes
-- Created: 2026-02-15

ALTER TABLE teams ADD COLUMN theme VARCHAR(20) NOT NULL DEFAULT 'default';

ALTER TABLE teams ADD CONSTRAINT chk_teams_theme_valid
    CHECK (theme IN ('default', 'ocean', 'sunset', 'forest', 'midnight', 'lavender', 'coral', 'monochrome'));
