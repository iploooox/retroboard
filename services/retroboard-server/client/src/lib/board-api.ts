import { api } from './api';

// ---- API response types (snake_case, matching server) ----

export type BoardPhase = 'write' | 'group' | 'vote' | 'discuss' | 'action';

export interface CardReaction {
  emoji: string;
  count: number;
  reacted: boolean;
}

export interface BoardCard {
  id: string;
  column_id: string;
  board_id: string;
  content: string;
  author_id: string | null;
  author_name: string | null;
  position: number;
  vote_count: number;
  user_votes: number;
  group_id: string | null;
  reactions?: CardReaction[];
  created_at: string;
  updated_at: string;
}

export interface BoardColumn {
  id: string;
  board_id: string;
  name: string;
  color: string;
  position: number;
  created_at: string;
  cards: BoardCard[];
}

export interface BoardGroup {
  id: string;
  board_id: string;
  title: string;
  position: number;
  card_ids: string[];
  total_votes: number;
  created_at: string;
}

export interface Board {
  id: string;
  sprint_id: string;
  template_id: string;
  phase: BoardPhase;
  anonymous_mode: boolean;
  max_votes_per_user: number;
  max_votes_per_card: number;
  focus_item_id: string | null;
  focus_item_type: 'card' | 'group' | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface BoardData extends Board {
  columns: BoardColumn[];
  groups: BoardGroup[];
  user_votes_remaining: number;
  user_total_votes_cast: number;
}

export interface VoteResult {
  card_id: string;
  vote_count: number;
  user_votes: number;
  user_votes_remaining: number;
  user_total_votes_cast: number;
}

export interface ActionItem {
  id: string;
  boardId: string;
  cardId: string | null;
  cardText: string | null;
  title: string;
  description: string | null;
  assigneeId: string | null;
  assigneeName: string | null;
  dueDate: string | null;
  status: 'open' | 'in_progress' | 'done';
  carriedFromId: string | null;
  carriedFromSprintName: string | null;
  createdBy: string;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface ActionItemsList {
  items: ActionItem[];
  total: number;
  limit: number;
  offset: number;
}

export interface CarryOverResult {
  carriedOver: Array<{ id: string; originalId: string; title: string }>;
  skipped: Array<{ originalId: string; title: string; reason: string }>;
  alreadyCarried: Array<{ originalId: string; existingId: string; title: string }>;
  sourceSprintName: string;
  totalResolved: number;
  totalSkipped: number;
  totalAlreadyCarried: number;
}

// Helper to unwrap { ok: true, data: T } envelope
interface OkResponse<T> {
  ok: true;
  data: T;
}

export const boardApi = {
  // Board CRUD
  createBoard: (sprintId: string, body: {
    template_id: string;
    anonymous_mode?: boolean;
    max_votes_per_user?: number;
    max_votes_per_card?: number;
  }) =>
    api.post<OkResponse<BoardData>>(`/sprints/${sprintId}/board`, body).then(r => r.data),

  getBoard: (sprintId: string) =>
    api.get<OkResponse<BoardData>>(`/sprints/${sprintId}/board`).then(r => r.data),

  updateBoard: (boardId: string, body: {
    anonymous_mode?: boolean;
    max_votes_per_user?: number;
    max_votes_per_card?: number;
  }) =>
    api.put<OkResponse<Board>>(`/boards/${boardId}`, body).then(r => r.data),

  // Cards
  addCard: (boardId: string, body: { column_id: string; content: string }) =>
    api.post<OkResponse<BoardCard>>(`/boards/${boardId}/cards`, body).then(r => r.data),

  updateCard: (boardId: string, cardId: string, body: { content?: string; column_id?: string; position?: number }) =>
    api.put<OkResponse<BoardCard>>(`/boards/${boardId}/cards/${cardId}`, body).then(r => r.data),

  deleteCard: (boardId: string, cardId: string) =>
    api.delete<OkResponse<{ id: string; deleted: true }>>(`/boards/${boardId}/cards/${cardId}`).then(r => r.data),

  // Votes
  vote: (boardId: string, cardId: string) =>
    api.post<OkResponse<VoteResult>>(`/boards/${boardId}/cards/${cardId}/vote`).then(r => r.data),

  removeVote: (boardId: string, cardId: string) =>
    api.delete<OkResponse<VoteResult>>(`/boards/${boardId}/cards/${cardId}/vote`).then(r => r.data),

  // Groups
  createGroup: (boardId: string, body: { title: string; card_ids?: string[] }) =>
    api.post<OkResponse<BoardGroup>>(`/boards/${boardId}/groups`, body).then(r => r.data),

  updateGroup: (boardId: string, groupId: string, body: {
    title?: string;
    add_card_ids?: string[];
    remove_card_ids?: string[];
    position?: number;
  }) =>
    api.put<OkResponse<BoardGroup>>(`/boards/${boardId}/groups/${groupId}`, body).then(r => r.data),

  deleteGroup: (boardId: string, groupId: string) =>
    api.delete<OkResponse<{ id: string; deleted: true; ungrouped_card_ids: string[] }>>(`/boards/${boardId}/groups/${groupId}`).then(r => r.data),

  // Phase & Focus
  setPhase: (boardId: string, phase: BoardPhase) =>
    api.put<OkResponse<{ id: string; phase: BoardPhase; previous_phase: BoardPhase; updated_at: string }>>(`/boards/${boardId}/phase`, { phase }).then(r => r.data),

  setFocus: (boardId: string, focusItemId: string | null, focusItemType: 'card' | 'group' | null) =>
    api.put<OkResponse<{ id: string; focus_item_id: string | null; focus_item_type: 'card' | 'group' | null; updated_at: string }>>(`/boards/${boardId}/focus`, {
      focus_item_id: focusItemId,
      focus_item_type: focusItemType,
    }).then(r => r.data),

  // Action Items
  getActionItems: (boardId: string) =>
    api.get<ActionItemsList>(`/boards/${boardId}/action-items`),

  createActionItem: (boardId: string, body: {
    title: string;
    description?: string;
    cardId?: string;
    assigneeId?: string;
    dueDate?: string;
  }) =>
    api.post<ActionItem>(`/boards/${boardId}/action-items`, body),

  updateActionItem: (id: string, body: {
    title?: string;
    description?: string | null;
    assigneeId?: string | null;
    dueDate?: string | null;
    status?: 'open' | 'in_progress' | 'done';
  }) =>
    api.put<ActionItem>(`/action-items/${id}`, body),

  deleteActionItem: (id: string) =>
    api.delete<void>(`/action-items/${id}`),

  carryOverActionItems: (boardId: string) =>
    api.post<CarryOverResult>(`/boards/${boardId}/action-items/carry-over`),

  // Export
  exportBoard: async (boardId: string, format: 'json' | 'markdown' | 'html'): Promise<Blob> => {
    const token = localStorage.getItem('access_token');
    const response = await fetch(`/api/v1/boards/${boardId}/export?format=${format}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Export failed');
    }
    return response.blob();
  },

  // Reactions
  toggleReaction: (cardId: string, emoji: string) =>
    api.post<OkResponse<{ card_id: string; reactions: CardReaction[] }>>(`/cards/${cardId}/reactions`, { emoji }).then(r => r.data),

  removeReaction: (cardId: string, _emoji: string) =>
    api.delete<OkResponse<{ card_id: string; reactions: CardReaction[] }>>(`/cards/${cardId}/reactions`).then(r => r.data),
};
