import WebSocket from 'ws';

interface ClientInfo {
  ws: WebSocket;
  userId: string;
}

export class RoomManager {
  private rooms: Map<string, Map<string, ClientInfo>> = new Map();

  join(boardId: string, clientId: string, ws: WebSocket, userId: string): void {
    let room = this.rooms.get(boardId);
    if (!room) {
      room = new Map();
      this.rooms.set(boardId, room);
    }
    room.set(clientId, { ws, userId });
  }

  leave(boardId: string, clientId: string): void {
    const room = this.rooms.get(boardId);
    if (!room) return;
    room.delete(clientId);
    if (room.size === 0) {
      this.rooms.delete(boardId);
    }
  }

  getClients(boardId: string): Map<string, ClientInfo> {
    return this.rooms.get(boardId) ?? new Map();
  }

  getRoomSize(boardId: string): number {
    return this.rooms.get(boardId)?.size ?? 0;
  }

  broadcast(boardId: string, message: object, excludeClientId?: string): void {
    const room = this.rooms.get(boardId);
    if (!room) return;
    const data = JSON.stringify(message);
    for (const [clientId, client] of room) {
      if (excludeClientId && clientId === excludeClientId) continue;
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(data);
      }
    }
  }

  removeClient(clientId: string): void {
    for (const [boardId, room] of this.rooms) {
      room.delete(clientId);
      if (room.size === 0) {
        this.rooms.delete(boardId);
      }
    }
  }

  getUserBoards(userId: string): Set<string> {
    const boards = new Set<string>();
    for (const [boardId, room] of this.rooms) {
      for (const client of room.values()) {
        if (client.userId === userId) {
          boards.add(boardId);
          break;
        }
      }
    }
    return boards;
  }
}
