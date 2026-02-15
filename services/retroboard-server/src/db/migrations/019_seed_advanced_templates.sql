-- Migration: 019_seed_advanced_templates
-- Description: Seed 4 advanced system templates (4Ls, Mad/Sad/Glad, Sailboat, Starfish)
-- Created: 2026-02-15

-- Seed advanced system templates with fixed UUIDs
INSERT INTO templates (id, name, description, is_system, team_id, created_by) VALUES
  (
    '00000000-0000-4000-8000-000000000003',
    '4Ls',
    'Four-column emotional and aspirational reflection on what you Liked, Learned, Lacked, and Longed For.',
    true,
    NULL,
    NULL
  ),
  (
    '00000000-0000-4000-8000-000000000004',
    'Mad / Sad / Glad',
    'Emotion-based format to surface feelings and address frustrations from the sprint.',
    true,
    NULL,
    NULL
  ),
  (
    '00000000-0000-4000-8000-000000000005',
    'Sailboat',
    'Use the sailboat metaphor to explore forces affecting the team''s journey toward its goals.',
    true,
    NULL,
    NULL
  ),
  (
    '00000000-0000-4000-8000-000000000006',
    'Starfish',
    'Five-dimension analysis for nuanced feedback on team practices and behaviors.',
    true,
    NULL,
    NULL
  )
ON CONFLICT (id) DO NOTHING;

-- Seed template columns for 4Ls
INSERT INTO template_columns (id, template_id, name, color, prompt_text, position) VALUES
  (
    '00000000-0000-4000-8003-000000000001',
    '00000000-0000-4000-8000-000000000003',
    'Liked',
    '#22c55e',
    'What did you like about this sprint?',
    0
  ),
  (
    '00000000-0000-4000-8003-000000000002',
    '00000000-0000-4000-8000-000000000003',
    'Learned',
    '#3b82f6',
    'What did you learn?',
    1
  ),
  (
    '00000000-0000-4000-8003-000000000003',
    '00000000-0000-4000-8000-000000000003',
    'Lacked',
    '#f59e0b',
    'What was lacking or missing?',
    2
  ),
  (
    '00000000-0000-4000-8003-000000000004',
    '00000000-0000-4000-8000-000000000003',
    'Longed For',
    '#8b5cf6',
    'What did you long for or wish you had?',
    3
  )
ON CONFLICT (id) DO NOTHING;

-- Seed template columns for Mad / Sad / Glad
INSERT INTO template_columns (id, template_id, name, color, prompt_text, position) VALUES
  (
    '00000000-0000-4000-8004-000000000001',
    '00000000-0000-4000-8000-000000000004',
    'Mad',
    '#ef4444',
    'What made you mad or frustrated?',
    0
  ),
  (
    '00000000-0000-4000-8004-000000000002',
    '00000000-0000-4000-8000-000000000004',
    'Sad',
    '#6366f1',
    'What made you sad or disappointed?',
    1
  ),
  (
    '00000000-0000-4000-8004-000000000003',
    '00000000-0000-4000-8000-000000000004',
    'Glad',
    '#22c55e',
    'What made you glad or happy?',
    2
  )
ON CONFLICT (id) DO NOTHING;

-- Seed template columns for Sailboat
INSERT INTO template_columns (id, template_id, name, color, prompt_text, position) VALUES
  (
    '00000000-0000-4000-8005-000000000001',
    '00000000-0000-4000-8000-000000000005',
    'Wind (Helps Us)',
    '#22c55e',
    'What propels us forward?',
    0
  ),
  (
    '00000000-0000-4000-8005-000000000002',
    '00000000-0000-4000-8000-000000000005',
    'Anchor (Holds Us Back)',
    '#ef4444',
    'What holds us back?',
    1
  ),
  (
    '00000000-0000-4000-8005-000000000003',
    '00000000-0000-4000-8000-000000000005',
    'Rocks (Risks)',
    '#f59e0b',
    'What risks lie ahead?',
    2
  ),
  (
    '00000000-0000-4000-8005-000000000004',
    '00000000-0000-4000-8000-000000000005',
    'Island (Goals)',
    '#3b82f6',
    'What is our destination?',
    3
  )
ON CONFLICT (id) DO NOTHING;

-- Seed template columns for Starfish
INSERT INTO template_columns (id, template_id, name, color, prompt_text, position) VALUES
  (
    '00000000-0000-4000-8006-000000000001',
    '00000000-0000-4000-8000-000000000006',
    'Keep Doing',
    '#22c55e',
    'What should we continue doing?',
    0
  ),
  (
    '00000000-0000-4000-8006-000000000002',
    '00000000-0000-4000-8000-000000000006',
    'More Of',
    '#3b82f6',
    'What should we do more of?',
    1
  ),
  (
    '00000000-0000-4000-8006-000000000003',
    '00000000-0000-4000-8000-000000000006',
    'Less Of',
    '#f59e0b',
    'What should we do less of?',
    2
  ),
  (
    '00000000-0000-4000-8006-000000000004',
    '00000000-0000-4000-8000-000000000006',
    'Stop Doing',
    '#ef4444',
    'What should we stop doing?',
    3
  ),
  (
    '00000000-0000-4000-8006-000000000005',
    '00000000-0000-4000-8000-000000000006',
    'Start Doing',
    '#8b5cf6',
    'What should we start doing?',
    4
  )
ON CONFLICT (id) DO NOTHING;
