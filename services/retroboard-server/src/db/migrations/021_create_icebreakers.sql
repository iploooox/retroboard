-- Migration: 021_create_icebreakers
-- Description: Create icebreakers and team_icebreaker_history tables, seed system icebreaker questions
-- Created: 2026-02-15

-- Create icebreakers table
CREATE TABLE IF NOT EXISTS icebreakers (
    id          UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    question    TEXT            NOT NULL,
    category    VARCHAR(20)     NOT NULL,
    is_system   BOOLEAN         NOT NULL DEFAULT true,
    created_by  UUID,
    team_id     UUID,
    created_at  TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_icebreakers_created_by
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    CONSTRAINT fk_icebreakers_team
        FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    CONSTRAINT chk_icebreakers_category_valid
        CHECK (category IN ('fun', 'team-building', 'reflective', 'creative', 'quick')),
    CONSTRAINT chk_icebreakers_system_no_team
        CHECK (
            (is_system = true AND team_id IS NULL AND created_by IS NULL) OR
            (is_system = false AND team_id IS NOT NULL)
        )
);

-- Create team_icebreaker_history table
CREATE TABLE IF NOT EXISTS team_icebreaker_history (
    id              UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id         UUID            NOT NULL,
    icebreaker_id   UUID            NOT NULL,
    board_id        UUID,
    used_at         TIMESTAMPTZ     NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_team_icebreaker_history_team
        FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
    CONSTRAINT fk_team_icebreaker_history_icebreaker
        FOREIGN KEY (icebreaker_id) REFERENCES icebreakers(id) ON DELETE CASCADE,
    CONSTRAINT fk_team_icebreaker_history_board
        FOREIGN KEY (board_id) REFERENCES boards(id) ON DELETE SET NULL
);

-- Indexes for icebreakers
CREATE INDEX IF NOT EXISTS idx_icebreakers_category ON icebreakers(category);
CREATE INDEX IF NOT EXISTS idx_icebreakers_is_system ON icebreakers(is_system);
CREATE INDEX IF NOT EXISTS idx_icebreakers_team_id ON icebreakers(team_id);

-- Indexes for team_icebreaker_history
CREATE INDEX IF NOT EXISTS idx_team_icebreaker_history_team_used
    ON team_icebreaker_history(team_id, used_at DESC);
CREATE INDEX IF NOT EXISTS idx_team_icebreaker_history_icebreaker
    ON team_icebreaker_history(icebreaker_id);

-- Seed system icebreaker questions
-- Category: fun (15 questions)
INSERT INTO icebreakers (id, question, category, is_system) VALUES
  ('00000000-0000-4000-9001-000000000001', 'If you could have any superpower for one sprint, what would it be?', 'fun', true),
  ('00000000-0000-4000-9001-000000000002', 'What''s the most interesting thing you''ve read or watched recently?', 'fun', true),
  ('00000000-0000-4000-9001-000000000003', 'If our team was a band, what genre would we play?', 'fun', true),
  ('00000000-0000-4000-9001-000000000004', 'What''s your go-to snack during deep work?', 'fun', true),
  ('00000000-0000-4000-9001-000000000005', 'If you could instantly master any skill, what would it be?', 'fun', true),
  ('00000000-0000-4000-9001-000000000006', 'What emoji best describes your week?', 'fun', true),
  ('00000000-0000-4000-9001-000000000007', 'If you could teleport anywhere for lunch, where would you go?', 'fun', true),
  ('00000000-0000-4000-9001-000000000008', 'What''s the most underrated tool or app you use?', 'fun', true),
  ('00000000-0000-4000-9001-000000000009', 'If our sprint was a movie, what would the title be?', 'fun', true),
  ('00000000-0000-4000-9001-000000000010', 'What''s on your bucket list that might surprise us?', 'fun', true),
  ('00000000-0000-4000-9001-000000000011', 'What fictional team would you want to join for a sprint?', 'fun', true),
  ('00000000-0000-4000-9001-000000000012', 'If you could automate one thing in your daily life, what would it be?', 'fun', true),
  ('00000000-0000-4000-9001-000000000013', 'What''s the best piece of advice you''ve ever received?', 'fun', true),
  ('00000000-0000-4000-9001-000000000014', 'If you had to describe your coding style as a cooking style, what would it be?', 'fun', true),
  ('00000000-0000-4000-9001-000000000015', 'What would your theme song be when you walk into standup?', 'fun', true)
ON CONFLICT (id) DO NOTHING;

-- Category: team-building (10 questions)
INSERT INTO icebreakers (id, question, category, is_system) VALUES
  ('00000000-0000-4000-9002-000000000001', 'What''s one thing you appreciate about someone on this team?', 'team-building', true),
  ('00000000-0000-4000-9002-000000000002', 'What''s a skill you have that the team might not know about?', 'team-building', true),
  ('00000000-0000-4000-9002-000000000003', 'What''s the best team moment from this sprint?', 'team-building', true),
  ('00000000-0000-4000-9002-000000000004', 'How would you describe our team culture in three words?', 'team-building', true),
  ('00000000-0000-4000-9002-000000000005', 'What''s one thing we could do to make our retrospectives even better?', 'team-building', true),
  ('00000000-0000-4000-9002-000000000006', 'Who on the team has helped you the most recently, and how?', 'team-building', true),
  ('00000000-0000-4000-9002-000000000007', 'What''s one thing you''d like to learn from a teammate?', 'team-building', true),
  ('00000000-0000-4000-9002-000000000008', 'If you could add one rule to our team agreement, what would it be?', 'team-building', true),
  ('00000000-0000-4000-9002-000000000009', 'What''s the funniest thing that happened during this sprint?', 'team-building', true),
  ('00000000-0000-4000-9002-000000000010', 'What makes you most proud to be part of this team?', 'team-building', true)
ON CONFLICT (id) DO NOTHING;

-- Category: reflective (10 questions)
INSERT INTO icebreakers (id, question, category, is_system) VALUES
  ('00000000-0000-4000-9003-000000000001', 'What''s one thing you learned this sprint that surprised you?', 'reflective', true),
  ('00000000-0000-4000-9003-000000000002', 'What was the biggest challenge you faced, and how did you handle it?', 'reflective', true),
  ('00000000-0000-4000-9003-000000000003', 'If you could go back to the start of the sprint, what would you do differently?', 'reflective', true),
  ('00000000-0000-4000-9003-000000000004', 'What''s one habit you''ve developed that makes you more productive?', 'reflective', true),
  ('00000000-0000-4000-9003-000000000005', 'What''s something that went wrong but taught you a valuable lesson?', 'reflective', true),
  ('00000000-0000-4000-9003-000000000006', 'How has your approach to work changed in the last year?', 'reflective', true),
  ('00000000-0000-4000-9003-000000000007', 'What''s one risk you took this sprint? Did it pay off?', 'reflective', true),
  ('00000000-0000-4000-9003-000000000008', 'What''s the most important thing you want to achieve next sprint?', 'reflective', true),
  ('00000000-0000-4000-9003-000000000009', 'What process or practice should we experiment with?', 'reflective', true),
  ('00000000-0000-4000-9003-000000000010', 'Looking back at the last three sprints, what trend do you notice?', 'reflective', true)
ON CONFLICT (id) DO NOTHING;

-- Category: creative (10 questions)
INSERT INTO icebreakers (id, question, category, is_system) VALUES
  ('00000000-0000-4000-9004-000000000001', 'Describe your sprint in exactly three words.', 'creative', true),
  ('00000000-0000-4000-9004-000000000002', 'If you could redesign one thing about our workflow, what would it be?', 'creative', true),
  ('00000000-0000-4000-9004-000000000003', 'Draw a picture (or describe in words) how the sprint felt.', 'creative', true),
  ('00000000-0000-4000-9004-000000000004', 'Create a headline for a newspaper article about this sprint.', 'creative', true),
  ('00000000-0000-4000-9004-000000000005', 'If our team was a startup, what would our pitch be?', 'creative', true),
  ('00000000-0000-4000-9004-000000000006', 'Invent a new word that describes a common experience in our team.', 'creative', true),
  ('00000000-0000-4000-9004-000000000007', 'What metaphor best describes our current project?', 'creative', true),
  ('00000000-0000-4000-9004-000000000008', 'If you could write a fortune cookie message for the team, what would it say?', 'creative', true),
  ('00000000-0000-4000-9004-000000000009', 'Design the perfect sprint playlist — what''s the first song?', 'creative', true),
  ('00000000-0000-4000-9004-000000000010', 'If our codebase was a city, which neighborhood would you live in?', 'creative', true)
ON CONFLICT (id) DO NOTHING;

-- Category: quick (10 questions)
INSERT INTO icebreakers (id, question, category, is_system) VALUES
  ('00000000-0000-4000-9005-000000000001', 'On a scale of 1-10, how energized are you today?', 'quick', true),
  ('00000000-0000-4000-9005-000000000002', 'One word to describe this sprint?', 'quick', true),
  ('00000000-0000-4000-9005-000000000003', 'Thumbs up, sideways, or down for this sprint?', 'quick', true),
  ('00000000-0000-4000-9005-000000000004', 'What''s your confidence level for next sprint (1-10)?', 'quick', true),
  ('00000000-0000-4000-9005-000000000005', 'Hot take: what''s an unpopular opinion about our process?', 'quick', true),
  ('00000000-0000-4000-9005-000000000006', 'Rate your work-life balance this sprint (1-10).', 'quick', true),
  ('00000000-0000-4000-9005-000000000007', 'What percentage of your time this sprint was spent on meaningful work?', 'quick', true),
  ('00000000-0000-4000-9005-000000000008', 'Traffic light check: red, yellow, or green for how you''re feeling?', 'quick', true),
  ('00000000-0000-4000-9005-000000000009', 'One thing you want to start next sprint?', 'quick', true),
  ('00000000-0000-4000-9005-000000000010', 'If you could change one thing about today, what would it be?', 'quick', true)
ON CONFLICT (id) DO NOTHING;
