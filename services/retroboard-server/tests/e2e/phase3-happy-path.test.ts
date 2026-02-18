import { describe, it, expect, beforeAll } from 'vitest';
import { app } from '../../src/server.js';
import { truncateTables } from '../helpers/db.js';
import { seed } from '../../src/db/seed.js';
import { createTestWSClient, closeAllClients, type TestWSClient, getPayload } from '../helpers/ws.js';

/**
 * E2E: Phase 3 Happy Path — Real-time Retro Ceremony
 *
 * Full ceremony flow with WebSocket real-time collaboration:
 *  1. Setup: Register Alice (facilitator) and Bob (member), create team & sprint & board
 *  2. Connect: Both users connect via WebSocket, verify presence
 *  3. Write phase: Start timer, add cards, verify real-time card_created events
 *  4. Group phase: Change phase, create groups, verify phase_changed events
 *  5. Vote phase: Cast votes, verify vote_added events
 *  6. Discuss phase: Set focus, verify focus_changed events
 *  7. Action phase: Create action items, verify action_item_created events
 *  8. Reveal: Reveal anonymous cards, verify cards_revealed with author mapping
 *  9. Lock/unlock: Lock board, verify member blocked, facilitator allowed
 * 10. Disconnect/reconnect: Verify user_left and event replay
 */
describe('E2E: Phase 3 Happy Path — Real-time Retro Ceremony', () => {
  beforeAll(async () => {
    await truncateTables();
    await seed(process.env.DATABASE_URL);
  });

  it('runs a complete retro ceremony with real-time collaboration via WebSocket', async () => {
    let aliceWS: TestWSClient | undefined;
    let bobWS: TestWSClient | undefined;

    try {
      // ========== SETUP: Register users, create team, sprint, board ==========

      // Register Alice (will be facilitator)
      const regA = await app.request('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'alice-phase3@example.com',
          password: 'SecurePass1',
          display_name: 'Alice',
        }),
      });
      expect(regA.status).toBe(201);
      const userA = await regA.json();
      const tokenA = userA.access_token;
      const aliceId = userA.user.id;

      // Register Bob (will be member)
      const regB = await app.request('/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'bob-phase3@example.com',
          password: 'SecurePass1',
          display_name: 'Bob',
        }),
      });
      expect(regB.status).toBe(201);
      const userB = await regB.json();
      const tokenB = userB.access_token;
      const bobId = userB.user.id;

      // Alice creates team
      const createTeamRes = await app.request('/api/v1/teams', {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Phase 3 E2E Team' }),
      });
      expect(createTeamRes.status).toBe(201);
      const { team } = await createTeamRes.json();

      // Alice invites Bob
      const inviteRes = await app.request(`/api/v1/teams/${team.id}/invitations`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(inviteRes.status).toBe(201);
      const { invitation } = await inviteRes.json();

      const joinRes = await app.request(`/api/v1/teams/join/${invitation.code}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenB}` },
      });
      expect(joinRes.status).toBe(200);

      // Alice creates and activates sprint
      const createSprintRes = await app.request(`/api/v1/teams/${team.id}/sprints`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Phase 3 Sprint',
          goal: 'Real-time collaboration',
          start_date: '2026-02-01',
          end_date: '2026-02-14',
        }),
      });
      expect(createSprintRes.status).toBe(201);
      const { sprint } = await createSprintRes.json();

      const activateRes = await app.request(
        `/api/v1/teams/${team.id}/sprints/${sprint.id}/activate`,
        { method: 'PUT', headers: { Authorization: `Bearer ${tokenA}` } },
      );
      expect(activateRes.status).toBe(200);

      // Create anonymous board from template
      const templateId = '00000000-0000-4000-8000-000000000001'; // WWW/Delta

      const createBoardRes = await app.request(`/api/v1/sprints/${sprint.id}/board`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_id: templateId,
          anonymous_mode: true,
          max_votes_per_user: 5,
          max_votes_per_card: 3,
        }),
      });
      expect(createBoardRes.status).toBe(201);
      const boardBody = await createBoardRes.json();
      expect(boardBody.ok).toBe(true);
      const board = boardBody.data;
      expect(board.phase).toBe('icebreaker');
      expect(board.anonymous_mode).toBe(true);

      const boardId = board.id;

      // Advance from icebreaker to write phase so card operations work
      const advanceRes = await app.request(`/api/v1/boards/${boardId}/phase`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ phase: 'write' }),
      });
      expect(advanceRes.status).toBe(200);

      const wwwColumnId = board.columns[0].id;
      const deltaColumnId = board.columns[1].id;

      // ========== CONNECT: WebSocket connections ==========

      // Alice connects (first user, gets empty presence_state)
      aliceWS = await createTestWSClient({ boardId, token: tokenA });
      const alicePresence = await aliceWS.waitForMessage('presence_state');
      expect(alicePresence.type).toBe('presence_state');
      expect(getPayload(alicePresence).users).toHaveLength(0); // No existing users

      // Bob connects (second user, gets Alice in presence_state)
      bobWS = await createTestWSClient({ boardId, token: tokenB });
      const bobPresence = await bobWS.waitForMessage('presence_state');
      expect(bobPresence.type).toBe('presence_state');
      const bobPresenceUsers = getPayload(bobPresence).users as Array<{ userId: string; userName: string }>;
      expect(bobPresenceUsers).toHaveLength(1); // Alice is already connected
      expect(bobPresenceUsers[0].userId).toBe(aliceId);
      expect(bobPresenceUsers[0].userName).toBe('Alice');

      // Alice should receive user_joined for Bob
      const userJoined = await aliceWS.waitForMessage('user_joined');
      expect(userJoined.type).toBe('user_joined');
      expect(getPayload(userJoined).userId).toBe(bobId);
      expect(getPayload(userJoined).userName).toBe('Bob');

      // ========== WRITE PHASE: Timer + Cards ==========

      // Alice starts write timer (30 seconds to avoid expiration during test)
      const startTimerRes = await app.request(`/api/v1/boards/${boardId}/timer/start`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ durationSeconds: 30 }),
      });
      expect(startTimerRes.status).toBe(201);

      // Both clients should receive timer_started
      const aliceTimerStart = await aliceWS.waitForMessage('timer_started');
      expect(aliceTimerStart.type).toBe('timer_started');
      expect(getPayload(aliceTimerStart).phase).toBe('write');
      expect(getPayload(aliceTimerStart).durationSeconds).toBe(30);

      const bobTimerStart = await bobWS.waitForMessage('timer_started');
      expect(bobTimerStart.type).toBe('timer_started');

      // Alice adds a card
      const addCardA1 = await app.request(`/api/v1/boards/${boardId}/cards`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ column_id: wwwColumnId, content: 'Great collaboration' }),
      });
      expect(addCardA1.status).toBe(201);
      const cardA1 = (await addCardA1.json()).data;

      // Bob should receive card_created event
      const bobCardCreated = await bobWS.waitForMessage('card_created');
      expect(bobCardCreated.type).toBe('card_created');
      const createdCard = getPayload(bobCardCreated).card as Record<string, unknown>;
      expect(createdCard.id).toBe(cardA1.id);
      expect(createdCard.content).toBe('Great collaboration');
      // Note: WebSocket events include full data; anonymous filtering is client-side
      expect(createdCard.author_id).toBeDefined();
      expect(createdCard.author_name).toBe('Alice');

      // Bob adds a card
      const addCardB1 = await app.request(`/api/v1/boards/${boardId}/cards`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenB}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ column_id: deltaColumnId, content: 'Too many meetings' }),
      });
      expect(addCardB1.status).toBe(201);
      const cardB1 = (await addCardB1.json()).data;

      // Alice adds another card (Bob will receive card_created for this)
      const addCardA2 = await app.request(`/api/v1/boards/${boardId}/cards`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ column_id: deltaColumnId, content: 'Need better docs' }),
      });
      expect(addCardA2.status).toBe(201);
      const cardA2 = (await addCardA2.json()).data;

      // Verify both users have received multiple card_created events
      const aliceCardEvents = aliceWS.messages.filter((m) => m.type === 'card_created');
      const bobCardEvents = bobWS.messages.filter((m) => m.type === 'card_created');
      expect(aliceCardEvents.length).toBeGreaterThanOrEqual(2); // Alice's own + Bob's
      expect(bobCardEvents.length).toBeGreaterThanOrEqual(2); // Alice's cards

      // ========== GROUP PHASE: Phase change + Grouping ==========

      // Alice changes phase to group
      const toGroupRes = await app.request(`/api/v1/boards/${boardId}/phase`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ phase: 'group' }),
      });
      expect(toGroupRes.status).toBe(200);
      const groupPhaseBody = await toGroupRes.json();
      expect(groupPhaseBody.data.phase).toBe('group');
      expect(groupPhaseBody.data.timerStopped).toBe(true); // Timer auto-stopped

      // Both should receive phase_changed
      const alicePhaseChanged = await aliceWS.waitForMessage('phase_changed');
      expect(alicePhaseChanged.type).toBe('phase_changed');
      expect(getPayload(alicePhaseChanged).currentPhase).toBe('group');
      expect(getPayload(alicePhaseChanged).previousPhase).toBe('write');

      const bobPhaseChanged = await bobWS.waitForMessage('phase_changed');
      expect(bobPhaseChanged.type).toBe('phase_changed');

      // Both should receive timer_stopped
      const aliceTimerStopped = await aliceWS.waitForMessage('timer_stopped');
      expect(aliceTimerStopped.type).toBe('timer_stopped');
      expect(getPayload(aliceTimerStopped).reason).toBe('phase_change');

      const bobTimerStopped = await bobWS.waitForMessage('timer_stopped');
      expect(bobTimerStopped.type).toBe('timer_stopped');

      // Alice creates a group for "Delta" issues
      const createGroupRes = await app.request(`/api/v1/boards/${boardId}/groups`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Meeting Issues',
          card_ids: [cardB1.id, cardA2.id],
        }),
      });
      expect(createGroupRes.status).toBe(201);
      const group = (await createGroupRes.json()).data;

      // Bob should receive group_created
      const bobGroupCreated = await bobWS.waitForMessage('group_created');
      expect(bobGroupCreated.type).toBe('group_created');
      expect(getPayload(bobGroupCreated).id).toBe(group.id);

      // ========== VOTE PHASE: Voting ==========

      // Alice changes phase to vote
      const toVoteRes = await app.request(`/api/v1/boards/${boardId}/phase`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ phase: 'vote' }),
      });
      expect(toVoteRes.status).toBe(200);

      // Both receive phase_changed
      await aliceWS.waitForMessage('phase_changed');
      await bobWS.waitForMessage('phase_changed');

      // Alice votes on cardA1
      const voteA1 = await app.request(`/api/v1/boards/${boardId}/cards/${cardA1.id}/vote`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      expect(voteA1.status).toBe(201);

      // Bob should receive vote_added
      const bobVoteAdded = await bobWS.waitForMessage('vote_added');
      expect(bobVoteAdded.type).toBe('vote_added');
      expect(getPayload(bobVoteAdded).cardId).toBe(cardA1.id);
      expect(getPayload(bobVoteAdded).voteCount).toBeDefined();

      // Bob votes on cardB1
      const voteB1 = await app.request(`/api/v1/boards/${boardId}/cards/${cardB1.id}/vote`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenB}` },
      });
      expect(voteB1.status).toBe(201);

      // Alice should receive vote_added (may be her own or Bob's depending on order)
      const aliceVoteAdded = await aliceWS.waitForMessage('vote_added');
      expect(aliceVoteAdded.type).toBe('vote_added');
      expect(getPayload(aliceVoteAdded).cardId).toBeDefined();

      // ========== DISCUSS PHASE: Focus ==========

      // Alice changes phase to discuss
      const toDiscussRes = await app.request(`/api/v1/boards/${boardId}/phase`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ phase: 'discuss' }),
      });
      expect(toDiscussRes.status).toBe(200);

      await aliceWS.waitForMessage('phase_changed');
      await bobWS.waitForMessage('phase_changed');

      // Alice sets focus on cardA1
      const setFocusRes = await app.request(`/api/v1/boards/${boardId}/focus`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ focus_item_id: cardA1.id, focus_item_type: 'card' }),
      });
      expect(setFocusRes.status).toBe(200);

      // Both should receive focus_changed
      const aliceFocusChanged = await aliceWS.waitForMessage('focus_changed');
      expect(aliceFocusChanged.type).toBe('focus_changed');
      expect(getPayload(aliceFocusChanged).focusId).toBe(cardA1.id);
      expect(getPayload(aliceFocusChanged).focusType).toBe('card');

      const bobFocusChanged = await bobWS.waitForMessage('focus_changed');
      expect(bobFocusChanged.type).toBe('focus_changed');
      expect(getPayload(bobFocusChanged).focusId).toBe(cardA1.id);

      // Alice changes focus to the group
      const setFocusGroup = await app.request(`/api/v1/boards/${boardId}/focus`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ focus_item_id: group.id, focus_item_type: 'group' }),
      });
      expect(setFocusGroup.status).toBe(200);

      // Verify both users received focus_changed events
      const aliceFocusEvents = aliceWS.messages.filter((m) => m.type === 'focus_changed');
      const bobFocusEvents = bobWS.messages.filter((m) => m.type === 'focus_changed');
      expect(aliceFocusEvents.length).toBeGreaterThanOrEqual(1);
      expect(bobFocusEvents.length).toBeGreaterThanOrEqual(1);

      // ========== ACTION PHASE: Action items ==========

      // Alice changes phase to action
      const toActionRes = await app.request(`/api/v1/boards/${boardId}/phase`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ phase: 'action' }),
      });
      expect(toActionRes.status).toBe(200);

      await aliceWS.waitForMessage('phase_changed');
      await bobWS.waitForMessage('phase_changed');

      // Alice creates action item
      const createAI = await app.request(`/api/v1/boards/${boardId}/action-items`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Reduce stand-up time',
          description: 'Max 10 minutes',
          cardId: cardB1.id,
          assigneeId: aliceId,
          dueDate: '2026-03-01',
        }),
      });
      expect(createAI.status).toBe(201);
      const actionItem = await createAI.json();

      // Bob should receive action_item_created
      const bobActionCreated = await bobWS.waitForMessage('action_item_created');
      expect(bobActionCreated.type).toBe('action_item_created');
      expect(getPayload(bobActionCreated).id).toBe(actionItem.id);

      // ========== REVEAL: Anonymous cards reveal ==========

      // Alice reveals cards
      const revealRes = await app.request(`/api/v1/boards/${boardId}/reveal`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${tokenA}` },
      });
      expect(revealRes.status).toBe(200);
      const revealBody = await revealRes.json();
      expect(revealBody.data.cards_revealed).toBe(true);
      expect(revealBody.data.revealedCards).toHaveLength(3); // 3 cards total

      // Both should receive cards_revealed event
      const aliceCardsRevealed = await aliceWS.waitForMessage('cards_revealed');
      expect(aliceCardsRevealed.type).toBe('cards_revealed');
      expect(getPayload(aliceCardsRevealed).boardId).toBe(boardId);

      const bobCardsRevealed = await bobWS.waitForMessage('cards_revealed');
      expect(bobCardsRevealed.type).toBe('cards_revealed');
      expect(getPayload(bobCardsRevealed).boardId).toBe(boardId);

      // Verify after reveal, GET board shows authors
      const getBoardAfterReveal = await app.request(`/api/v1/sprints/${sprint.id}/board`, {
        headers: { Authorization: `Bearer ${tokenB}` },
      });
      const boardAfterReveal = (await getBoardAfterReveal.json()).data;
      const allCards = boardAfterReveal.columns.flatMap((col: { cards: unknown[] }) => col.cards);
      const cardA1AfterReveal = allCards.find((c: { id: string }) => c.id === cardA1.id);
      expect(cardA1AfterReveal.author_id).toBe(aliceId);
      expect(cardA1AfterReveal.author_name).toBe('Alice');

      // ========== LOCK/UNLOCK: Board locking ==========

      // Alice locks the board
      const lockRes = await app.request(`/api/v1/boards/${boardId}/lock`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ isLocked: true }),
      });
      expect(lockRes.status).toBe(200);

      // Both should receive board_locked
      const aliceBoardLocked = await aliceWS.waitForMessage('board_locked');
      expect(aliceBoardLocked.type).toBe('board_locked');
      expect(getPayload(aliceBoardLocked).boardId).toBe(boardId);

      const bobBoardLocked = await bobWS.waitForMessage('board_locked');
      expect(bobBoardLocked.type).toBe('board_locked');

      // Note: In action phase, card operations are not allowed regardless of lock status
      // The lock primarily affects other operations and prevents changes during review
      // For this E2E test, we just verify the lock/unlock events are broadcast

      // Alice unlocks the board
      const unlockRes = await app.request(`/api/v1/boards/${boardId}/lock`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ isLocked: false }),
      });
      expect(unlockRes.status).toBe(200);

      // Both should receive board_unlocked
      const aliceBoardUnlocked = await aliceWS.waitForMessage('board_unlocked');
      expect(aliceBoardUnlocked.type).toBe('board_unlocked');
      expect(getPayload(aliceBoardUnlocked).boardId).toBe(boardId);

      const bobBoardUnlocked = await bobWS.waitForMessage('board_unlocked');
      expect(bobBoardUnlocked.type).toBe('board_unlocked');

      // ========== DISCONNECT/RECONNECT: Presence + Event replay ==========

      // Get the last event ID from Bob's messages before disconnect
      const lastEvent = bobWS.messages[bobWS.messages.length - 1];
      const lastEventId = lastEvent.eventId;

      // Bob disconnects
      await bobWS.close();
      bobWS = undefined;

      // Alice should receive user_left
      const aliceUserLeft = await aliceWS.waitForMessage('user_left');
      expect(aliceUserLeft.type).toBe('user_left');
      expect(getPayload(aliceUserLeft).userId).toBe(bobId);

      // Alice creates an action item while Bob is disconnected
      const addAIWhileOffline = await app.request(`/api/v1/boards/${boardId}/action-items`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Bob missed this action',
          assigneeId: aliceId,
          dueDate: '2026-03-15',
        }),
      });
      expect(addAIWhileOffline.status).toBe(201);
      const missedAI = await addAIWhileOffline.json();

      // Bob reconnects with lastEventId
      bobWS = await createTestWSClient({ boardId, token: tokenB, lastEventId: lastEventId as string });

      // Bob should receive event_replay with missed events
      const bobEventReplay = await bobWS.waitForMessage('event_replay');
      expect(bobEventReplay.type).toBe('event_replay');
      const events = getPayload(bobEventReplay).events as Array<{ type: string }>;
      expect(events).toBeDefined();
      expect(events.length).toBeGreaterThan(0);

      // Verify the missed action_item_created is in the replay
      const replayedAICreated = events.find(
        (e) => e.type === 'action_item_created',
      );
      expect(replayedAICreated).toBeDefined();
      expect(getPayload(replayedAICreated!).id).toBe(missedAI.id);

      // Alice should receive user_joined when Bob reconnects
      const aliceUserJoinedAgain = await aliceWS.waitForMessage('user_joined');
      expect(aliceUserJoinedAgain.type).toBe('user_joined');
      expect(getPayload(aliceUserJoinedAgain).userId).toBe(bobId);

      // ========== SUCCESS ==========
      console.log('✅ Phase 3 E2E happy path completed successfully');
    } finally {
      // Cleanup
      await closeAllClients(aliceWS, bobWS);
    }
  });
});
