import { sql } from '../../src/db/connection.js';

const TABLES_TO_TRUNCATE = [
  'action_items',
  'card_reactions',
  'card_group_members',
  'card_groups',
  'card_votes',
  'cards',
  'columns',
  'boards',
  'template_columns',
  'templates',
  'sprints',
  'team_invitations',
  'team_members',
  'refresh_tokens',
  'rate_limits',
];

export async function truncateTables() {
  // Delete custom icebreakers and history first (preserves system icebreakers)
  await sql`DELETE FROM team_icebreaker_history`;
  await sql`DELETE FROM icebreakers WHERE is_system = false`;

  // Truncate all tables except teams (to avoid cascading to icebreakers)
  await sql.unsafe(
    `TRUNCATE TABLE ${TABLES_TO_TRUNCATE.join(', ')} CASCADE`,
  );

  // Delete teams manually to avoid CASCADE to icebreakers
  await sql`DELETE FROM teams`;
  await sql`DELETE FROM users`;
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

export async function addTeamMember(teamId: string, userId: string, role: string) {
  await sql`INSERT INTO team_members (team_id, user_id, role) VALUES (${teamId}, ${userId}, ${role})`;
}

export async function createTestSprint(teamId: string, createdBy: string, overrides: {
  name?: string;
  status?: string;
  startDate?: string;
} = {}) {
  const status = overrides.status || 'active';
  // Auto-deactivate existing active sprint to avoid unique constraint violation
  if (status === 'active') {
    await sql`UPDATE sprints SET status = 'completed' WHERE team_id = ${teamId} AND status = 'active'`;
  }
  const [sprint] = await sql`
    INSERT INTO sprints (team_id, name, start_date, status, sprint_number, created_by)
    VALUES (
      ${teamId},
      ${overrides.name || 'Test Sprint'},
      ${overrides.startDate || '2026-03-01'},
      ${status},
      (SELECT COALESCE(MAX(sprint_number), 0) + 1 FROM sprints WHERE team_id = ${teamId}),
      ${createdBy}
    )
    RETURNING *
  `;
  return sprint;
}

export async function createTestBoard(sprintId: string, templateId: string, createdBy: string, overrides: {
  phase?: string;
  anonymous_mode?: boolean;
  max_votes_per_user?: number;
  max_votes_per_card?: number;
} = {}) {
  const [board] = await sql`
    INSERT INTO boards (sprint_id, template_id, phase, anonymous_mode, max_votes_per_user, max_votes_per_card, created_by)
    VALUES (
      ${sprintId},
      ${templateId},
      ${overrides.phase || 'write'},
      ${overrides.anonymous_mode ?? false},
      ${overrides.max_votes_per_user ?? 5},
      ${overrides.max_votes_per_card ?? 3},
      ${createdBy}
    )
    RETURNING *
  `;

  // Copy template columns
  const templateColumns = await sql`
    SELECT name, color, position FROM template_columns
    WHERE template_id = ${templateId}
    ORDER BY position
  `;

  const columns = [];
  for (const tc of templateColumns) {
    const [col] = await sql`
      INSERT INTO columns (board_id, name, color, position)
      VALUES (${board.id}, ${tc.name}, ${tc.color}, ${tc.position})
      RETURNING *
    `;
    columns.push(col);
  }

  return { board, columns };
}

export async function createTestCard(boardId: string, columnId: string, authorId: string, overrides: {
  content?: string;
  position?: number;
} = {}) {
  const [maxPos] = await sql`
    SELECT COALESCE(MAX(position), -1)::int AS max_pos FROM cards WHERE column_id = ${columnId}
  `;
  const [card] = await sql`
    INSERT INTO cards (board_id, column_id, author_id, content, position)
    VALUES (${boardId}, ${columnId}, ${authorId}, ${overrides.content || 'Test card'}, ${overrides.position ?? (maxPos.max_pos + 1)})
    RETURNING *
  `;
  return card;
}

export async function createTestGroup(boardId: string, title: string, cardIds: string[] = []) {
  const [maxPos] = await sql`
    SELECT COALESCE(MAX(position), -1)::int AS max_pos FROM card_groups WHERE board_id = ${boardId}
  `;
  const [group] = await sql`
    INSERT INTO card_groups (board_id, title, position)
    VALUES (${boardId}, ${title}, ${maxPos.max_pos + 1})
    RETURNING *
  `;

  for (const cardId of cardIds) {
    await sql`
      INSERT INTO card_group_members (group_id, card_id) VALUES (${group.id}, ${cardId})
      ON CONFLICT (card_id) DO UPDATE SET group_id = ${group.id}
    `;
  }

  return group;
}

export async function createTestActionItem(boardId: string, createdBy: string, overrides: {
  title?: string;
  description?: string;
  cardId?: string;
  assigneeId?: string;
  dueDate?: string;
  status?: string;
  carriedFromId?: string;
} = {}) {
  const [item] = await sql`
    INSERT INTO action_items (board_id, card_id, title, description, assignee_id, due_date, status, carried_from_id, created_by)
    VALUES (
      ${boardId},
      ${overrides.cardId || null},
      ${overrides.title || 'Test Action Item'},
      ${overrides.description || null},
      ${overrides.assigneeId || null},
      ${overrides.dueDate || null},
      ${overrides.status || 'open'},
      ${overrides.carriedFromId || null},
      ${createdBy}
    )
    RETURNING *
  `;
  return item;
}

export async function createTestVote(cardId: string, userId: string, voteNumber?: number) {
  const nextVote = voteNumber ?? (
    await sql`SELECT COALESCE(MAX(vote_number), 0)::int + 1 AS next FROM card_votes WHERE card_id = ${cardId} AND user_id = ${userId}`
  )[0].next;
  const [vote] = await sql`
    INSERT INTO card_votes (card_id, user_id, vote_number)
    VALUES (${cardId}, ${userId}, ${nextVote})
    RETURNING *
  `;
  return vote;
}

export async function setBoardPhase(boardId: string, phase: string) {
  await sql`UPDATE boards SET phase = ${phase} WHERE id = ${boardId}`;
}

// The seed creates system templates with known IDs
export const SYSTEM_TEMPLATE_WWD = '00000000-0000-4000-8000-000000000001';
export const SYSTEM_TEMPLATE_SSC = '00000000-0000-4000-8000-000000000002';

export async function refreshAnalyticsMaterializedViews() {
  await sql`REFRESH MATERIALIZED VIEW CONCURRENTLY mv_sprint_health`;
  await sql`REFRESH MATERIALIZED VIEW CONCURRENTLY mv_participation_stats`;
  await sql`REFRESH MATERIALIZED VIEW CONCURRENTLY mv_word_frequency`;
}
