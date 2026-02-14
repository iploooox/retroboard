# Real-Time Feature Test Plan

## Test Framework

- **Unit tests**: Vitest
- **Integration tests**: Vitest + `ws` client library (connecting to a real test server)
- **WebSocket client for tests**: `ws` library (same as server, used as client in tests)
- **Database**: Test PostgreSQL database, reset between test suites via transactions

---

## Unit Tests

### RoomManager

| # | Test Case | Input | Expected |
|---|-----------|-------|----------|
| 1 | Join adds client to room | `join("board-1", "client-1", ws, "user-1")` | Room "board-1" contains client-1 |
| 2 | Join creates room if not exists | `join("board-new", ...)` | New room created in map |
| 3 | Leave removes client from room | `leave("board-1", "client-1")` | Room "board-1" no longer contains client-1 |
| 4 | Leave deletes empty room | Leave last client | Room deleted from map |
| 5 | getClients returns all room clients | 3 clients joined | Returns Map with 3 entries |
| 6 | getClients returns empty for unknown room | Unknown boardId | Returns empty Map |
| 7 | broadcast sends to all clients in room | 3 clients in room | All 3 receive message |
| 8 | broadcast excludes specified client | Exclude client-2 | client-1 and client-3 receive, client-2 does not |
| 9 | broadcast ignores closed WebSockets | 1 of 3 sockets is CLOSED | Only 2 receive, no error thrown |
| 10 | removeClient removes from all rooms | Client in 2 rooms | Removed from both |
| 11 | getRoomSize returns correct count | 3 clients in room | Returns 3 |
| 12 | getUserBoards returns all boards for user | User in 2 boards | Returns Set with 2 boardIds |

### PresenceTracker

| # | Test Case | Input | Expected |
|---|-----------|-------|----------|
| 1 | addUser returns true for new user | First connection for user | Returns true |
| 2 | addUser returns false for duplicate user | Second tab same user | Returns false, connectionCount incremented |
| 3 | removeUser returns true when last connection | connectionCount goes to 0 | Returns true, user removed from board map |
| 4 | removeUser returns false when connections remain | connectionCount > 1 | Returns false, connectionCount decremented |
| 5 | getUsers returns all users for board | 3 users connected | Returns 3 PresenceInfo objects |
| 6 | getUsers returns empty for unknown board | Unknown boardId | Returns empty array |
| 7 | updateCursor updates position | `updateCursor("board-1", "user-1", {x:10, y:20})` | cursorPosition updated |
| 8 | isUserOnline returns true for connected | Connected user | Returns true |
| 9 | isUserOnline returns false for disconnected | Not connected | Returns false |
| 10 | Multi-tab: third tab increments count | 3 connections same user | connectionCount = 3 |
| 11 | Multi-tab: close one tab decrements | Close 1 of 3 | connectionCount = 2 |

### MessageRouter

| # | Test Case | Input | Expected |
|---|-----------|-------|----------|
| 1 | Valid ping message | `{ type: "ping" }` | Responds with `{ type: "pong" }` |
| 2 | Invalid JSON | `"not json"` | Error event sent to client |
| 3 | Unknown message type | `{ type: "unknown" }` | Error event with INVALID_MESSAGE code |
| 4 | Missing type field | `{ payload: {} }` | Error event sent |
| 5 | cursor_move with valid coords | `{ type: "cursor_move", payload: { x: 10, y: 20 } }` | Broadcast to room |
| 6 | cursor_move missing x | `{ payload: { y: 20 } }` | Error event sent |
| 7 | cursor_move with negative coords | `{ x: -10, y: -20 }` | Accepted (coordinates can be negative for scroll) |
| 8 | join_board switches rooms | Already in board-1, join board-2 | Left board-1, joined board-2 |
| 9 | Rate limit exceeded | 201 messages in 1 minute | Error with RATE_LIMITED code |

### Heartbeat Manager

| # | Test Case | Input | Expected |
|---|-----------|-------|----------|
| 1 | Active connection kept alive | Ping received within 45s | Connection maintained |
| 2 | Stale connection terminated | No ping for 45s | Connection terminated |
| 3 | Check interval runs every 30s | Wait 30s | Stale check executes |
| 4 | Terminated connection cleaned up | Connection terminated | Removed from room, user_left broadcast |

### Throttle

| # | Test Case | Input | Expected |
|---|-----------|-------|----------|
| 1 | First message passes through | First cursor_move | Relayed immediately |
| 2 | Second message within window dropped | 2 cursor_moves in 10ms | Only first relayed |
| 3 | Message after window passes through | cursor_move after 50ms | Relayed |
| 4 | Different users throttled independently | User A and B at same time | Both relayed |
| 5 | 20 messages in 1 second, only 20 pass | Rapid cursor_moves | Exactly 20 relayed |

---

## Integration Tests

### WebSocket Connection

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 1 | Successful connection with valid JWT | Connect with valid token + boardId | 101 Upgrade, receives presence_state |
| 2 | Connection rejected with invalid JWT | Connect with bad token | HTTP 401 response, no upgrade |
| 3 | Connection rejected with expired JWT | Connect with expired token | HTTP 401 response |
| 4 | Connection rejected without boardId | Connect with token only | HTTP 400 response |
| 5 | Connection rejected for non-member | Token for user not in board's team | HTTP 403 response |
| 6 | Connection rejected for non-existent board | Token valid, boardId doesn't exist | HTTP 404 response |
| 7 | Multiple clients connect to same board | 3 clients connect | Each receives presence_state, others get user_joined |
| 8 | Same user multiple tabs | 2 connections same userId | user_joined broadcast only once |
| 9 | Connection on non-/ws path ignored | Upgrade request on /api/... | Not handled by WS server |

### Presence

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 1 | First user joins | Client A connects | A receives presence_state with empty users |
| 2 | Second user joins | Client B connects after A | B receives presence_state with [A], A receives user_joined for B |
| 3 | User disconnects | Client A closes connection | B receives user_left for A |
| 4 | Multi-tab user disconnect one tab | A has 2 tabs, close one | No user_left broadcast (still connected) |
| 5 | Multi-tab user disconnect all tabs | A has 2 tabs, close both | user_left broadcast for A |
| 6 | User reconnects quickly | A disconnects and reconnects within 2s | user_left then user_joined (unless multi-tab) |

### Real-Time Event Propagation (via LISTEN/NOTIFY)

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 1 | Card creation propagates | Client A creates card via REST API | Client B receives card_created via WS |
| 2 | Card update propagates | Client A updates card via REST API | Client B receives card_updated via WS |
| 3 | Card deletion propagates | Client A deletes card via REST API | Client B receives card_deleted via WS |
| 4 | Vote added propagates | Client A votes via REST API | Client B receives vote_added via WS |
| 5 | Vote removed propagates | Client A removes vote via REST API | Client B receives vote_removed via WS |
| 6 | Group creation propagates | Facilitator creates group via REST API | All clients receive group_created |
| 7 | Phase change propagates | Facilitator changes phase via REST API | All clients receive phase_changed |
| 8 | Focus change propagates | Facilitator sets focus via REST API | All clients receive focus_changed |
| 9 | Events scoped to board | Card created on board-1 | Client on board-2 does NOT receive event |
| 10 | Event contains correct eventId | Card created | Event has non-empty eventId (UUID) |
| 11 | Event has server timestamp | Any event | timestamp field is valid ISO 8601 |
| 12 | Latency under 100ms | Card created, measure time to WS receipt | < 100ms |

### Cursor Sharing

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 1 | Cursor move relayed to others | Client A sends cursor_move | Client B receives cursor_move with user info |
| 2 | Cursor move not echoed to sender | Client A sends cursor_move | Client A does NOT receive it back |
| 3 | Throttled at 20/sec | Client A sends 30 in 1 second | Client B receives at most 20 |
| 4 | Cursor includes userId and name | Client A sends cursor_move | Payload includes userId, userName |

### Reconnection & Event Recovery

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 1 | Reconnect with lastEventId | Disconnect, events happen, reconnect with lastEventId | Receives event_replay with missed events |
| 2 | Reconnect without lastEventId | Disconnect and reconnect without lastEventId | Receives presence_state only, no replay |
| 3 | No missed events | Reconnect with current lastEventId | event_replay with empty events array |
| 4 | Many missed events paginated | 150 events missed | First replay has 100 events, hasMore=true |
| 5 | Unknown lastEventId | Very old or invalid lastEventId | Full board state sent, or error if too old |
| 6 | Events ordered correctly | Multiple events during disconnect | event_replay events in chronological order |
| 7 | Presence state after replay | Reconnect with lastEventId | presence_state sent after event_replay |

### Heartbeat

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 1 | Ping/pong keeps connection alive | Client sends ping every 25s | Connection stays open after 60s |
| 2 | No ping causes disconnect | Client stops sending ping | Server terminates connection after 45s |
| 3 | Pong response is immediate | Client sends ping | Server responds with pong within 10ms |

### LISTEN/NOTIFY Integration

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 1 | Channel subscribed on first join | First client joins board | LISTEN "board:{boardId}" executed |
| 2 | Channel unsubscribed on last leave | Last client leaves board | UNLISTEN "board:{boardId}" executed |
| 3 | Channel stays on multiple clients | 3 clients on board, 1 leaves | Channel still active |
| 4 | Listener reconnects on DB disconnect | Kill listener DB connection | Listener reconnects, re-subscribes channels |
| 5 | Trigger fires on card insert | INSERT INTO cards | NOTIFY sent on correct channel |
| 6 | Trigger fires on card update | UPDATE cards | NOTIFY sent with card_updated type |
| 7 | Trigger fires on card delete | DELETE FROM cards | NOTIFY sent with card_deleted type |
| 8 | Payload under 8KB | Create normal card | NOTIFY payload is valid JSON, under 8KB |
| 9 | Event logged in board_events | Card created | Row exists in board_events table |

---

## Load / Stress Tests

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 1 | 50 concurrent users on one board | 50 WS clients connected | All receive events, < 100ms latency |
| 2 | 200 concurrent connections total | 200 clients across 10 boards | Server stays responsive, memory < 200MB |
| 3 | Rapid card creation | 100 cards created in 10 seconds | All propagated to all clients |
| 4 | Mass reconnection | Kill and reconnect 50 clients simultaneously | All reconnect within 10s, events recovered |
| 5 | Cursor flood | 50 users moving cursors simultaneously | Server CPU < 80%, no dropped connections |

---

## Edge Cases

| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 1 | Client sends binary data | Send binary WebSocket frame | Error event, connection maintained |
| 2 | Client sends empty message | Send empty string | Error event, connection maintained |
| 3 | Client sends oversized message | Send 1MB JSON string | Error event, connection terminated |
| 4 | Server restarts | Kill and restart server | Clients reconnect with backoff |
| 5 | DB connection lost during notify | DB goes down | Server closes WS connections gracefully, error event |
| 6 | JWT expires mid-session | Token expires while connected | Server sends error with UNAUTHORIZED, closes |
| 7 | Board deleted while connected | Board deleted via API | Server sends error, closes connection |
| 8 | User removed from team while connected | Team membership revoked | Server sends error with FORBIDDEN, closes |
| 9 | Concurrent writes to same card | Two users update same card simultaneously | Both events propagate, last-write-wins |
| 10 | Unicode in messages | Card with emoji/CJK characters | Correctly propagated |

---

## Test Utilities

```typescript
// Helper to create authenticated WS connection for tests
async function createTestWSClient(options: {
  userId: string;
  boardId: string;
  lastEventId?: string;
}): Promise<TestWSClient> {
  const token = await createTestJWT(options.userId);
  const url = `ws://localhost:${TEST_PORT}/ws?token=${token}&boardId=${options.boardId}`;
  if (options.lastEventId) url += `&lastEventId=${options.lastEventId}`;
  const ws = new WebSocket(url);
  return new TestWSClient(ws);
}

// Helper to wait for specific message type
async function waitForMessage(client: TestWSClient, type: string, timeoutMs = 5000): Promise<WSMessage> {
  // ...
}

// Helper to collect all messages of a type
async function collectMessages(client: TestWSClient, type: string, count: number, timeoutMs = 5000): Promise<WSMessage[]> {
  // ...
}
```
