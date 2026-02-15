import { describe, it, expect, beforeAll } from 'vitest';
import { app } from '../../src/server.js';
import { truncateTables } from '../helpers/db.js';
import { seed } from '../../src/db/seed.js';
import { createTestWSClient, closeAllClients, type TestWSClient } from '../helpers/ws.js';

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
      expect(board.phase).toBe('write');
      expect(board.anonymous_mode).toBe(true);

      const boardId = board.id;
      const wwwColumnId = board.columns[0].id;
      const deltaColumnId = board.columns[1].id;

      // ========== CONNECT: WebSocket connections ==========

      // Alice connects (first user, gets empty presence_state)
      aliceWS = await createTestWSClient({ boardId, token: tokenA });
      const alicePresence = await aliceWS.waitForMessage('presence_state');
      expect(alicePresence.type).toBe('presence_state');
      expect(alicePresence.payload.users).toHaveLength(0); // No existing users

      // Bob connects (second user, gets Alice in presence_state)
      bobWS = await createTestWSClient({ boardId, token: tokenB });
      const bobPresence = await bobWS.waitForMessage('presence_state');
      expect(bobPresence.type).toBe('presence_state');
      expect(bobPresence.payload.users).toHaveLength(1); // Alice is already connected
      expect(bobPresence.payload.users[0].userId).toBe(aliceId);
      expect(bobPresence.payload.users[0].userName).toBe('Alice');

      // Alice should receive user_joined for Bob
      const userJoined = await aliceWS.waitForMessage('user_joined');
      expect(userJoined.type).toBe('user_joined');
      expect(userJoined.payload.userId).toBe(bobId);
      expect(userJoined.payload.userName).toBe('Bob');

      // ========== WRITE PHASE: Timer + Cards ==========

      // Alice starts write timer (5 seconds for test speed)
      const startTimerRes = await app.request(`/api/v1/boards/${boardId}/timer`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ durationSeconds: 5 }),
      });
      expect(startTimerRes.status).toBe(201);

      // Both clients should receive timer_started
      const aliceTimerStart = await aliceWS.waitForMessage('timer_started');
      expect(aliceTimerStart.type).toBe('timer_started');
      expect(aliceTimerStart.payload.phase).toBe('write');
      expect(aliceTimerStart.payload.durationSeconds).toBe(5);

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
      expect(bobCardCreated.payload.card.id).toBe(cardA1.id);
      expect(bobCardCreated.payload.card.content).toBe('Great collaboration');
      // In anonymous mode, Bob should NOT see the author
      expect(bobCardCreated.payload.card.author_id).toBeNull();
      expect(bobCardCreated.payload.card.author_name).toBeNull();

      // Bob adds a card
      const addCardB1 = await app.request(`/api/v1/boards/${boardId}/cards`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenB}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ column_id: deltaColumnId, content: 'Too many meetings' }),
      });
      expect(addCardB1.status).toBe(201);
      const cardB1 = (await addCardB1.json()).data;

      // Alice should receive card_created event
      const aliceCardCreated = await aliceWS.waitForMessage('card_created');
      expect(aliceCardCreated.type).toBe('card_created');
      expect(aliceCardCreated.payload.card.id).toBe(cardB1.id);
      expect(aliceCardCreated.payload.card.content).toBe('Too many meetings');
      // Anonymous mode applies
      expect(aliceCardCreated.payload.card.author_id).toBeNull();

      // Alice adds another card
      const addCardA2 = await app.request(`/api/v1/boards/${boardId}/cards`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ column_id: deltaColumnId, content: 'Need better docs' }),
      });
      expect(addCardA2.status).toBe(201);
      const cardA2 = (await addCardA2.json()).data;

      await bobWS.waitForMessage('card_created'); // Bob receives it

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
      expect(alicePhaseChanged.payload.newPhase).toBe('group');
      expect(alicePhaseChanged.payload.previousPhase).toBe('write');

      const bobPhaseChanged = await bobWS.waitForMessage('phase_changed');
      expect(bobPhaseChanged.type).toBe('phase_changed');

      // Both should receive timer_stopped
      const aliceTimerStopped = await aliceWS.waitForMessage('timer_stopped');
      expect(aliceTimerStopped.type).toBe('timer_stopped');
      expect(aliceTimerStopped.payload.reason).toBe('phase_change');

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
      expect(bobGroupCreated.payload.group.id).toBe(group.id);
      expect(bobGroupCreated.payload.group.title).toBe('Meeting Issues');
      expect(bobGroupCreated.payload.group.card_ids).toHaveLength(2);

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
      expect(bobVoteAdded.payload.cardId).toBe(cardA1.id);
      // In anonymous mode, voter_id should be hidden
      expect(bobVoteAdded.payload.voterId).toBeNull();

      // Bob votes on cardB1
      const voteB1 = await app.request(`/api/v1/boards/${boardId}/cards/${cardB1.id}/vote`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenB}` },
      });
      expect(voteB1.status).toBe(201);

      // Alice should receive vote_added
      const aliceVoteAdded = await aliceWS.waitForMessage('vote_added');
      expect(aliceVoteAdded.type).toBe('vote_added');
      expect(aliceVoteAdded.payload.cardId).toBe(cardB1.id);

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
      expect(aliceFocusChanged.payload.focusItemId).toBe(cardA1.id);
      expect(aliceFocusChanged.payload.focusItemType).toBe('card');

      const bobFocusChanged = await bobWS.waitForMessage('focus_changed');
      expect(bobFocusChanged.type).toBe('focus_changed');
      expect(bobFocusChanged.payload.focusItemId).toBe(cardA1.id);

      // Alice changes focus to the group
      const setFocusGroup = await app.request(`/api/v1/boards/${boardId}/focus`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ focus_item_id: group.id, focus_item_type: 'group' }),
      });
      expect(setFocusGroup.status).toBe(200);

      // Both receive focus_changed again
      const aliceFocusChanged2 = await aliceWS.waitForMessage('focus_changed');
      expect(aliceFocusChanged2.payload.focusItemId).toBe(group.id);
      expect(aliceFocusChanged2.payload.focusItemType).toBe('group');

      const bobFocusChanged2 = await bobWS.waitForMessage('focus_changed');
      expect(bobFocusChanged2.payload.focusItemId).toBe(group.id);

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
      expect(bobActionCreated.payload.actionItem.id).toBe(actionItem.id);
      expect(bobActionCreated.payload.actionItem.title).toBe('Reduce stand-up time');

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

      // Both should receive cards_revealed with author mapping
      const aliceCardsRevealed = await aliceWS.waitForMessage('cards_revealed');
      expect(aliceCardsRevealed.type).toBe('cards_revealed');
      expect(aliceCardsRevealed.payload.revealedCards).toHaveLength(3);
      const revealedCard1 = aliceCardsRevealed.payload.revealedCards.find(
        (c: { cardId: string }) => c.cardId === cardA1.id,
      );
      expect(revealedCard1.authorId).toBe(aliceId);
      expect(revealedCard1.authorName).toBe('Alice');

      const bobCardsRevealed = await bobWS.waitForMessage('cards_revealed');
      expect(bobCardsRevealed.type).toBe('cards_revealed');
      expect(bobCardsRevealed.payload.revealedCards).toHaveLength(3);

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
      expect(aliceBoardLocked.payload.isLocked).toBe(true);

      const bobBoardLocked = await bobWS.waitForMessage('board_locked');
      expect(bobBoardLocked.type).toBe('board_locked');

      // Bob (member) tries to add a card — should be blocked
      const addCardLocked = await app.request(`/api/v1/boards/${boardId}/cards`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenB}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ column_id: wwwColumnId, content: 'Should be blocked' }),
      });
      expect(addCardLocked.status).toBe(403);

      // Alice (facilitator) can still add cards
      const addCardFacilitator = await app.request(`/api/v1/boards/${boardId}/cards`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ column_id: wwwColumnId, content: 'Facilitator can add' }),
      });
      expect(addCardFacilitator.status).toBe(201);

      // Bob receives card_created from Alice
      const bobCardFromFacilitator = await bobWS.waitForMessage('card_created');
      expect(bobCardFromFacilitator.payload.card.content).toBe('Facilitator can add');

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
      expect(aliceBoardUnlocked.payload.isLocked).toBe(false);

      const bobBoardUnlocked = await bobWS.waitForMessage('board_unlocked');
      expect(bobBoardUnlocked.type).toBe('board_unlocked');

      // Bob can now add cards again
      const addCardAfterUnlock = await app.request(`/api/v1/boards/${boardId}/cards`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenB}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ column_id: wwwColumnId, content: 'Bob can add again' }),
      });
      expect(addCardAfterUnlock.status).toBe(201);

      // Alice receives card_created from Bob
      const aliceCardAfterUnlock = await aliceWS.waitForMessage('card_created');
      expect(aliceCardAfterUnlock.payload.card.content).toBe('Bob can add again');

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
      expect(aliceUserLeft.payload.userId).toBe(bobId);

      // Alice adds a card while Bob is disconnected
      const addCardWhileOffline = await app.request(`/api/v1/boards/${boardId}/cards`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokenA}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ column_id: deltaColumnId, content: 'Bob missed this' }),
      });
      expect(addCardWhileOffline.status).toBe(201);

      // Bob reconnects with lastEventId
      bobWS = await createTestWSClient({ boardId, token: tokenB, lastEventId });

      // Bob should receive event_replay with missed events
      const bobEventReplay = await bobWS.waitForMessage('event_replay');
      expect(bobEventReplay.type).toBe('event_replay');
      expect(bobEventReplay.payload.events).toBeDefined();
      expect(bobEventReplay.payload.events.length).toBeGreaterThan(0);

      // Verify the missed card_created is in the replay
      const replayedCardCreated = bobEventReplay.payload.events.find(
        (e: { type: string }) => e.type === 'card_created',
      );
      expect(replayedCardCreated).toBeDefined();
      expect(replayedCardCreated.payload.card.content).toBe('Bob missed this');

      // Alice should receive user_joined when Bob reconnects
      const aliceUserJoinedAgain = await aliceWS.waitForMessage('user_joined');
      expect(aliceUserJoinedAgain.type).toBe('user_joined');
      expect(aliceUserJoinedAgain.payload.userId).toBe(bobId);

      // ========== SUCCESS ==========
      console.log('✅ Phase 3 E2E happy path completed successfully');
    } finally {
      // Cleanup
      await closeAllClients(aliceWS, bobWS);
    }
  });
});
