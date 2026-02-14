import { sql } from '../../src/db/connection.js';

const TABLES_TO_TRUNCATE = [
  'template_columns',
  'templates',
  'sprints',
  'team_invitations',
  'team_members',
  'teams',
  'refresh_tokens',
  'rate_limits',
  'users',
];

export async function truncateTables() {
  await sql.unsafe(
    `TRUNCATE TABLE ${TABLES_TO_TRUNCATE.join(', ')} CASCADE`,
  );
}

export async function createTestUser(overrides: {
  email?: string;
  displayName?: string;
  passwordHash?: string;
} = {}) {
  const [user] = await sql`
    INSERT INTO users (email, password_hash, display_name)
    VALUES (
      ${overrides.email || `test-${Date.now()}@example.com`},
      ${overrides.passwordHash || '$2a$12$LJ3Fa5sVRA7u.fRQE0IiLO5g6Ux5Zy3YMpOI2X.sr0MFNMNqpNXa'},
      ${overrides.displayName || 'Test User'}
    )
    RETURNING *
  `;
  return user;
}

export async function createTestTeam(createdBy: string, overrides: {
  name?: string;
  slug?: string;
} = {}) {
  const [team] = await sql`
    INSERT INTO teams (name, slug, created_by)
    VALUES (
      ${overrides.name || 'Test Team'},
      ${overrides.slug || `test-team-${Date.now()}`},
      ${createdBy}
    )
    RETURNING *
  `;

  // Add creator as admin
  await sql`
    INSERT INTO team_members (team_id, user_id, role)
    VALUES (${team.id}, ${createdBy}, 'admin')
  `;

  return team;
}
