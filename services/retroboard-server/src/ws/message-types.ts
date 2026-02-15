import type WebSocket from 'ws';

export interface ClientConnection {
  clientId: string;
  userId: string;
  userName: string;
  boardId: string;
  ws: WebSocket;
}

export type ClientMessageType = 'ping' | 'cursor_move' | 'join_board' | 'leave_board';

export type ServerMessageType =
  | 'pong'
  | 'presence_state'
  | 'user_joined'
  | 'user_left'
  | 'cursor_move'
  | 'card_created'
  | 'card_updated'
  | 'card_deleted'
  | 'vote_added'
  | 'vote_removed'
  | 'group_created'
  | 'group_updated'
  | 'group_deleted'
  | 'phase_changed'
  | 'focus_changed'
  | 'board_locked'
  | 'board_unlocked'
  | 'cards_revealed'
  | 'card_grouped'
  | 'card_ungrouped'
  | 'action_item_created'
  | 'action_item_updated'
  | 'action_item_deleted'
  | 'timer_started'
  | 'timer_paused'
  | 'timer_resumed'
  | 'timer_stopped'
  | 'timer_tick'
  | 'event_replay'
  | 'error';

export interface WSMessage {
  type: string;
  payload: Record<string, unknown>;
  timestamp: string;
  eventId: string;
}

export interface PresenceInfo {
  userId: string;
  userName: string;
  userAvatar: string;
  connectionCount: number;
  cursorPosition: { x: number; y: number } | null;
  joinedAt: Date;
}
