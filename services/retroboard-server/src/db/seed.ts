import postgres from 'postgres';

async function seed(databaseUrl?: string) {
  const url = databaseUrl || process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }

  const sql = postgres(url, { onnotice: () => {} });

  try {
    // Template 1: What Went Well / Delta
    await sql`
      INSERT INTO templates (id, name, description, is_system, team_id, created_by)
      VALUES (
        '00000000-0000-4000-8000-000000000001',
        'What Went Well / Delta',
        'Classic two-column format focusing on positives and changes needed. Simple and effective for teams of any size.',
        true, NULL, NULL
      ) ON CONFLICT (id) DO NOTHING
    `;

    await sql`
      INSERT INTO template_columns (id, template_id, name, color, prompt_text, position)
      VALUES
        ('00000000-0000-4000-8001-000000000001',
         '00000000-0000-4000-8000-000000000001',
         'What Went Well', '#22c55e',
         'What worked well this sprint? What are you proud of?', 0),
        ('00000000-0000-4000-8001-000000000002',
         '00000000-0000-4000-8000-000000000001',
         'Delta (What to Change)', '#ef4444',
         'What would you change? What could be improved?', 1)
      ON CONFLICT (id) DO NOTHING
    `;

    // Template 2: Start / Stop / Continue
    await sql`
      INSERT INTO templates (id, name, description, is_system, team_id, created_by)
      VALUES (
        '00000000-0000-4000-8000-000000000002',
        'Start / Stop / Continue',
        'Three actionable columns for behavioral feedback. Great for identifying concrete changes the team should make.',
        true, NULL, NULL
      ) ON CONFLICT (id) DO NOTHING
    `;

    await sql`
      INSERT INTO template_columns (id, template_id, name, color, prompt_text, position)
      VALUES
        ('00000000-0000-4000-8002-000000000001',
         '00000000-0000-4000-8000-000000000002',
         'Start Doing', '#22c55e',
         'What should the team start doing?', 0),
        ('00000000-0000-4000-8002-000000000002',
         '00000000-0000-4000-8000-000000000002',
         'Stop Doing', '#ef4444',
         'What should the team stop doing?', 1),
        ('00000000-0000-4000-8002-000000000003',
         '00000000-0000-4000-8000-000000000002',
         'Continue Doing', '#3b82f6',
         'What should the team continue doing?', 2)
      ON CONFLICT (id) DO NOTHING
    `;

    // Template 3: 4Ls
    await sql`
      INSERT INTO templates (id, name, description, is_system, team_id, created_by)
      VALUES (
        '00000000-0000-4000-8000-000000000003',
        '4Ls',
        'Four L''s retrospective: Liked, Learned, Lacked, and Longed For. Comprehensive format for deep reflection.',
        true, NULL, NULL
      ) ON CONFLICT (id) DO NOTHING
    `;

    await sql`
      INSERT INTO template_columns (id, template_id, name, color, prompt_text, position)
      VALUES
        ('00000000-0000-4000-8003-000000000001',
         '00000000-0000-4000-8000-000000000003',
         'Liked', '#22c55e',
         'What did you like about this sprint?', 0),
        ('00000000-0000-4000-8003-000000000002',
         '00000000-0000-4000-8000-000000000003',
         'Learned', '#3b82f6',
         'What did you learn?', 1),
        ('00000000-0000-4000-8003-000000000003',
         '00000000-0000-4000-8000-000000000003',
         'Lacked', '#f59e0b',
         'What was missing or lacking?', 2),
        ('00000000-0000-4000-8003-000000000004',
         '00000000-0000-4000-8000-000000000003',
         'Longed For', '#8b5cf6',
         'What did you wish for or long for?', 3)
      ON CONFLICT (id) DO NOTHING
    `;

    // Template 4: Mad / Sad / Glad
    await sql`
      INSERT INTO templates (id, name, description, is_system, team_id, created_by)
      VALUES (
        '00000000-0000-4000-8000-000000000004',
        'Mad / Sad / Glad',
        'Emotion-focused retrospective to surface feelings and improve team morale.',
        true, NULL, NULL
      ) ON CONFLICT (id) DO NOTHING
    `;

    await sql`
      INSERT INTO template_columns (id, template_id, name, color, prompt_text, position)
      VALUES
        ('00000000-0000-4000-8004-000000000001',
         '00000000-0000-4000-8000-000000000004',
         'Mad', '#ef4444',
         'What made you mad or frustrated?', 0),
        ('00000000-0000-4000-8004-000000000002',
         '00000000-0000-4000-8000-000000000004',
         'Sad', '#6366f1',
         'What made you sad or disappointed?', 1),
        ('00000000-0000-4000-8004-000000000003',
         '00000000-0000-4000-8000-000000000004',
         'Glad', '#22c55e',
         'What made you glad or happy?', 2)
      ON CONFLICT (id) DO NOTHING
    `;

    // Template 5: Sailboat
    await sql`
      INSERT INTO templates (id, name, description, is_system, team_id, created_by)
      VALUES (
        '00000000-0000-4000-8000-000000000005',
        'Sailboat',
        'Sailboat metaphor: Wind (helps), Anchor (holds back), Rocks (risks), and Island (goals).',
        true, NULL, NULL
      ) ON CONFLICT (id) DO NOTHING
    `;

    await sql`
      INSERT INTO template_columns (id, template_id, name, color, prompt_text, position)
      VALUES
        ('00000000-0000-4000-8005-000000000001',
         '00000000-0000-4000-8000-000000000005',
         'Wind (Helps Us)', '#22c55e',
         'What is helping us move forward?', 0),
        ('00000000-0000-4000-8005-000000000002',
         '00000000-0000-4000-8000-000000000005',
         'Anchor (Holds Us Back)', '#ef4444',
         'What is slowing us down or holding us back?', 1),
        ('00000000-0000-4000-8005-000000000003',
         '00000000-0000-4000-8000-000000000005',
         'Rocks (Risks)', '#f59e0b',
         'What risks or obstacles are ahead?', 2),
        ('00000000-0000-4000-8005-000000000004',
         '00000000-0000-4000-8000-000000000005',
         'Island (Goals)', '#3b82f6',
         'What are we aiming for?', 3)
      ON CONFLICT (id) DO NOTHING
    `;

    // Template 6: Starfish
    await sql`
      INSERT INTO templates (id, name, description, is_system, team_id, created_by)
      VALUES (
        '00000000-0000-4000-8000-000000000006',
        'Starfish',
        'Five-column format for nuanced feedback: Keep Doing, More Of, Less Of, Stop Doing, Start Doing.',
        true, NULL, NULL
      ) ON CONFLICT (id) DO NOTHING
    `;

    await sql`
      INSERT INTO template_columns (id, template_id, name, color, prompt_text, position)
      VALUES
        ('00000000-0000-4000-8006-000000000001',
         '00000000-0000-4000-8000-000000000006',
         'Keep Doing', '#22c55e',
         'What should we keep doing?', 0),
        ('00000000-0000-4000-8006-000000000002',
         '00000000-0000-4000-8000-000000000006',
         'More Of', '#3b82f6',
         'What should we do more of?', 1),
        ('00000000-0000-4000-8006-000000000003',
         '00000000-0000-4000-8000-000000000006',
         'Less Of', '#f59e0b',
         'What should we do less of?', 2),
        ('00000000-0000-4000-8006-000000000004',
         '00000000-0000-4000-8000-000000000006',
         'Stop Doing', '#ef4444',
         'What should we stop doing?', 3),
        ('00000000-0000-4000-8006-000000000005',
         '00000000-0000-4000-8000-000000000006',
         'Start Doing', '#8b5cf6',
         'What should we start doing?', 4)
      ON CONFLICT (id) DO NOTHING
    `;

    // Note: Icebreakers are seeded in migration 021_create_icebreakers.sql

    console.log('Seed data applied successfully.');
  } finally {
    await sql.end();
  }
}

const isMainModule = process.argv[1] &&
  (process.argv[1].endsWith('seed.ts') || process.argv[1].endsWith('seed.js'));

if (isMainModule) {
  seed().catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
}

export { seed };
