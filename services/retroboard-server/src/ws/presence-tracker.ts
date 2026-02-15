export interface PresenceUserInfo {
  userId: string;
  userName: string;
  userAvatar: string;
}

interface PresenceEntry {
  userId: string;
  userName: string;
  userAvatar: string;
  connectionCount: number;
  cursorPosition: { x: number; y: number } | null;
  joinedAt: Date;
}

export class PresenceTracker {
  private boards: Map<string, Map<string, PresenceEntry>> = new Map();

  addUser(boardId: string, userId: string, info: PresenceUserInfo): boolean {
    let board = this.boards.get(boardId);
    if (!board) {
      board = new Map();
      this.boards.set(boardId, board);
    }
    const existing = board.get(userId);
    if (existing) {
      existing.connectionCount++;
      return false;
    }
    board.set(userId, {
      userId: info.userId,
      userName: info.userName,
      userAvatar: info.userAvatar,
      connectionCount: 1,
      cursorPosition: null,
      joinedAt: new Date(),
    });
    return true;
  }

  removeUser(boardId: string, userId: string): boolean {
    const board = this.boards.get(boardId);
    if (!board) return true;
    const entry = board.get(userId);
    if (!entry) return true;
    entry.connectionCount--;
    if (entry.connectionCount <= 0) {
      board.delete(userId);
      if (board.size === 0) {
        this.boards.delete(boardId);
      }
      return true;
    }
    return false;
  }

  getUsers(boardId: string): PresenceEntry[] {
    const board = this.boards.get(boardId);
    if (!board) return [];
    return Array.from(board.values());
  }

  updateCursor(boardId: string, userId: string, position: { x: number; y: number }): void {
    const board = this.boards.get(boardId);
    if (!board) return;
    const entry = board.get(userId);
    if (!entry) return;
    entry.cursorPosition = position;
  }

  isUserOnline(boardId: string, userId: string): boolean {
    const board = this.boards.get(boardId);
    if (!board) return false;
    return board.has(userId);
  }
}
