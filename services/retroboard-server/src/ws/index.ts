import { randomUUID } from 'node:crypto';
import type http from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { verifyToken } from '../utils/jwt.js';
import { sql } from '../db/connection.js';
import { RoomManager } from './room-manager.js';
import { PresenceTracker } from './presence-tracker.js';
import { MessageRouter } from './message-router.js';
import { HeartbeatManager } from './heartbeat.js';
import { CursorThrottle } from './throttle.js';
import { NotifyListener } from './notify-listener.js';
import { getEventsAfter } from './event-replay.js';

const HEARTBEAT_CHECK_MS = 30_000;
const HEARTBEAT_STALE_MS = 45_000;

// Shared instances
const roomManager = new RoomManager();
const presenceTracker = new PresenceTracker();
const cursorThrottle = new CursorThrottle({ maxPerSecond: 20 });
// Track clientId -> { boardId, ws } for stale connection handling
const clientRegistry = new Map<string, { boardId: string; userId: string; userName: string; ws: WebSocket }>();

let heartbeatManager: HeartbeatManager;
let notifyListener: NotifyListener;
let messageRouter: MessageRouter;

export function setupWebSocket(server: http.Server): () => Promise<void> {
  const wss = new WebSocketServer({ noServer: true });

  // Heartbeat: on stale, terminate the connection
  heartbeatManager = new HeartbeatManager({
    checkIntervalMs: HEARTBEAT_CHECK_MS,
    staleThresholdMs: HEARTBEAT_STALE_MS,
    onStale: (clientId) => {
      handleStaleClient(clientId);
    },
  });

  // Message router
  messageRouter = new MessageRouter({
    broadcast: (boardId, message, excludeClientId) => {
      roomManager.broadcast(boardId, message, excludeClientId);
    },
  });

  // PG LISTEN/NOTIFY listener
  notifyListener = new NotifyListener((boardId, message) => {
    roomManager.broadcast(boardId, message);
  });

  // Handle HTTP upgrade requests
  server.on('upgrade', (req, socket, head) => {
    handleUpgrade(wss, req, socket, head);
  });

  // Cleanup function
  return async () => {
    heartbeatManager.stop();
    await notifyListener.close();
    wss.close();
  };
}

async function handleUpgrade(
  wss: WebSocketServer,
  req: http.IncomingMessage,
  socket: import('node:stream').Duplex,
  head: Buffer,
): Promise<void> {
  try {
    const url = new URL(req.url ?? '', `http://localhost`);

    // Only handle /ws path
    if (url.pathname !== '/ws') {
      socket.destroy();
      return;
    }

    const token = url.searchParams.get('token');
    const boardId = url.searchParams.get('boardId');
    const lastEventId = url.searchParams.get('lastEventId') || null;

    if (!boardId) {
      socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
      socket.destroy();
      return;
    }

    if (!token) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    // Verify JWT
    let userId: string;
    try {
      const payload = await verifyToken(token);
      userId = payload.sub;
    } catch {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    // Check board exists and get team ID
    const [boardRow] = await sql`
      SELECT s.team_id
      FROM boards b
      JOIN sprints s ON s.id = b.sprint_id
      WHERE b.id = ${boardId}
    `;
    if (!boardRow) {
      socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
      socket.destroy();
      return;
    }

    const teamId = boardRow.team_id as string;

    // Check user is a team member
    const [memberRow] = await sql`
      SELECT role FROM team_members
      WHERE team_id = ${teamId} AND user_id = ${userId}
    `;
    if (!memberRow) {
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      socket.destroy();
      return;
    }

    // Get user display name
    const [userRow] = await sql`
      SELECT display_name FROM users WHERE id = ${userId}
    `;
    const userName = (userRow?.display_name as string) ?? 'Anonymous';

    // Upgrade to WebSocket
    wss.handleUpgrade(req, socket, head, (ws) => {
      handleConnection(ws, { userId, userName, boardId, lastEventId });
    });
  } catch (err) {
    console.error('WebSocket upgrade error:', err);
    socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
    socket.destroy();
  }
}

async function handleConnection(
  ws: WebSocket,
  opts: {
    userId: string;
    userName: string;
    boardId: string;
    lastEventId: string | null;
  },
): Promise<void> {
  const { userId, userName, boardId, lastEventId } = opts;
  const clientId = randomUUID();

  // Register in client registry for stale connection lookup
  clientRegistry.set(clientId, { boardId, userId, userName, ws });

  // Get current presence BEFORE adding new user
  const existingUsers = presenceTracker.getUsers(boardId);

  // Join room
  roomManager.join(boardId, clientId, ws, userId);

  // Update presence
  const isNewUser = presenceTracker.addUser(boardId, userId, {
    userId,
    userName,
    userAvatar: '',
  });

  // Subscribe to PG LISTEN for this board
  await notifyListener.subscribe(boardId);

  // Register for heartbeat
  heartbeatManager.register(clientId, ws);

  // Send event replay if lastEventId provided
  if (lastEventId) {
    try {
      const { events, hasMore } = await getEventsAfter(boardId, lastEventId);
      ws.send(JSON.stringify({
        type: 'event_replay',
        payload: {
          fromEventId: lastEventId,
          events,
          hasMore,
        },
        timestamp: new Date().toISOString(),
        eventId: '',
      }));
    } catch (err) {
      console.error('Error fetching event replay:', err);
    }
  }

  // Send presence_state to joining client (existing users before this one joined)
  ws.send(JSON.stringify({
    type: 'presence_state',
    payload: {
      boardId,
      users: existingUsers.map((u) => ({
        userId: u.userId,
        userName: u.userName,
        userAvatar: u.userAvatar,
        connectedAt: u.joinedAt.toISOString(),
        cursorPosition: u.cursorPosition,
      })),
    },
    timestamp: new Date().toISOString(),
    eventId: '',
  }));

  // Broadcast user_joined to others (only if new user, not multi-tab)
  if (isNewUser) {
    roomManager.broadcast(boardId, {
      type: 'user_joined',
      payload: {
        userId,
        userName,
        userAvatar: '',
        connectedAt: new Date().toISOString(),
      },
      timestamp: new Date().toISOString(),
      eventId: '',
    }, clientId);
  }

  // Handle incoming messages
  ws.on('message', (data) => {
    heartbeatManager.recordPing(clientId);
    const raw = data.toString();

    // Check for cursor_move throttle
    try {
      const parsed = JSON.parse(raw);
      if (parsed.type === 'cursor_move') {
        if (!cursorThrottle.shouldAllow(userId)) {
          return; // Drop throttled cursor moves silently
        }
      }
    } catch {
      // Will be handled by the message router
    }

    messageRouter.handleMessage(
      { clientId, userId, userName, boardId, ws },
      raw,
    );
  });

  // Handle disconnect
  ws.on('close', async () => {
    clientRegistry.delete(clientId);
    heartbeatManager.unregister(clientId);
    roomManager.leave(boardId, clientId);
    const isGone = presenceTracker.removeUser(boardId, userId);

    if (isGone) {
      roomManager.broadcast(boardId, {
        type: 'user_left',
        payload: { userId, userName },
        timestamp: new Date().toISOString(),
        eventId: '',
      });
    }

    // Unsubscribe from PG LISTEN if no more clients on this board
    if (roomManager.getRoomSize(boardId) === 0) {
      await notifyListener.unsubscribe(boardId);
    }
  });
}

function handleStaleClient(clientId: string): void {
  const info = clientRegistry.get(clientId);
  if (info) {
    info.ws.terminate();
    // The 'close' event handler will clean up room/presence/heartbeat
  }
}

/** Export broadcast function for manual WebSocket event broadcasting (e.g., timer events) */
export function broadcastToBoard(boardId: string, event: { type: string; payload: Record<string, unknown> }): void {
  if (!roomManager) {
    console.warn('RoomManager not initialized, cannot broadcast');
    return;
  }
  const message = {
    type: event.type,
    payload: event.payload,
    timestamp: new Date().toISOString(),
    eventId: randomUUID(),
  };
  roomManager.broadcast(boardId, message);
}
