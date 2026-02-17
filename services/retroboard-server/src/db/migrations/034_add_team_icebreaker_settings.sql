-- S-008: Team icebreaker settings
-- Adds configuration columns to teams for icebreaker behavior

ALTER TABLE teams ADD COLUMN IF NOT EXISTS icebreaker_enabled BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS icebreaker_default_category VARCHAR(20);
ALTER TABLE teams ADD COLUMN IF NOT EXISTS icebreaker_timer_seconds INTEGER;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_icebreaker_category') THEN
    ALTER TABLE teams ADD CONSTRAINT chk_icebreaker_category
      CHECK (icebreaker_default_category IS NULL OR icebreaker_default_category IN ('fun', 'team-building', 'reflective', 'creative', 'quick'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_icebreaker_timer') THEN
    ALTER TABLE teams ADD CONSTRAINT chk_icebreaker_timer
      CHECK (icebreaker_timer_seconds IS NULL OR (icebreaker_timer_seconds >= 30 AND icebreaker_timer_seconds <= 600));
  END IF;
END $$;
