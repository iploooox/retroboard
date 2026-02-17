import { sql } from '../../src/db/connection.js';

// Test database object types
export type TestUser = { id: string; email: string; display_name: string };
export type TestTeam = { id: string; name: string; slug: string; updated_at?: Date };
export type TestSprint = { id: string; name: string; team_id: string; status: string };
export type TestBoard = { id: string; sprint_id: string; template_id: string; phase: string; anonymous_mode: boolean; max_votes_per_user: number; max_votes_per_card: number; created_by: string };
export type TestColumn = { id: string; board_id: string; name: string; color: string; position: number };
export type TestCard = { id: string; board_id: string; column_id: string; author_id: string; content: string; position: number };
export type TestGroup = { id: string; board_id: string; title: string; position: number };
export type TestActionItem = { id: string; board_id: string; card_id: string | null; title: string; description: string | null; assignee_id: string | null; due_date: string | null; status: string; carried_from_id: string | null; created_by: string; updated_at?: Date };
export type TestVote = { id: string; card_id: string; user_id: string; vote_number: number };

export async function truncateTables() {
  // Single round-trip: all cleanup in one sql.unsafe() call
  await sql.unsafe(`
    DELETE FROM icebreaker_responses;
    DELETE FROM team_icebreaker_history;
    DELETE FROM icebreakers WHERE is_system = false;
    TRUNCATE TABLE
      action_items, card_reactions, card_group_members, card_groups,
      card_votes, cards, columns, boards, template_columns, templates,
      sprints, team_invitations, team_members, refresh_tokens, rate_limits
    CASCADE;
    DELETE FROM teams;
    DELETE FROM users;
  `);
}

export async function createTestUser(overrides: {
  email?: string;
  displayName?: string;
  passwordHash?: string;
} = {}): Promise<TestUser> {
  const [user] = await sql<Array<TestUser>>`
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
} = {}): Promise<TestTeam> {
  const [team] = await sql<Array<TestTeam>>`
    INSERT INTO teams (name, slug, created_by)
    VALUES (
      ${overrides.name || 'Test Team'},
      ${overrides.slug || `test-team-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`},
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
} = {}): Promise<TestSprint> {
  const status = overrides.status || 'active';
  // Auto-deactivate existing active sprint to avoid unique constraint violation
  if (status === 'active') {
    await sql`UPDATE sprints SET status = 'completed' WHERE team_id = ${teamId} AND status = 'active'`;
  }
  const [sprint] = await sql<Array<TestSprint>>`
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
} = {}): Promise<{ board: TestBoard; columns: TestColumn[] }> {
  const [board] = await sql<Array<TestBoard>>`
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
  const templateColumns = await sql<Array<{ name: string; color: string; position: number }>>`
    SELECT name, color, position FROM template_columns
    WHERE template_id = ${templateId}
    ORDER BY position
  `;

  const columns: TestColumn[] = [];
  for (const tc of templateColumns) {
    const [col] = await sql<Array<TestColumn>>`
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
} = {}): Promise<TestCard> {
  const [maxPos] = await sql<Array<{ max_pos: number }>>`
    SELECT COALESCE(MAX(position), -1)::int AS max_pos FROM cards WHERE column_id = ${columnId}
  `;
  const [card] = await sql<Array<TestCard>>`
    INSERT INTO cards (board_id, column_id, author_id, content, position)
    VALUES (${boardId}, ${columnId}, ${authorId}, ${overrides.content || 'Test card'}, ${overrides.position ?? (maxPos.max_pos + 1)})
    RETURNING *
  `;
  return card;
}

export async function createTestGroup(boardId: string, title: string, cardIds: string[] = []): Promise<TestGroup> {
  const [maxPos] = await sql<Array<{ max_pos: number }>>`
    SELECT COALESCE(MAX(position), -1)::int AS max_pos FROM card_groups WHERE board_id = ${boardId}
  `;
  const [group] = await sql<Array<TestGroup>>`
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
} = {}): Promise<TestActionItem> {
  const [item] = await sql<Array<TestActionItem>>`
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

export async function createTestVote(cardId: string, userId: string, voteNumber?: number): Promise<TestVote> {
  const nextVote = voteNumber ?? (
    await sql<Array<{ next: number }>>`SELECT COALESCE(MAX(vote_number), 0)::int + 1 AS next FROM card_votes WHERE card_id = ${cardId} AND user_id = ${userId}`
  )[0].next;
  const [vote] = await sql<Array<TestVote>>`
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
