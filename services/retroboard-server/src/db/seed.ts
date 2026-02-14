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
