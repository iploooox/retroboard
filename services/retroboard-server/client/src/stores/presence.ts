import { create } from 'zustand';

export interface PresenceUser {
  userId: string;
  userName: string;
  userAvatar: string;
  connectedAt: string;
  cursorPosition: { x: number; y: number } | null;
}

interface PresenceState {
  users: Map<string, PresenceUser>;

  // Actions
  setUsers: (users: PresenceUser[]) => void;
  addUser: (user: PresenceUser) => void;
  removeUser: (userId: string) => void;
  updateCursor: (userId: string, position: { x: number; y: number } | null) => void;
  reset: () => void;

  // Derived
  getUserList: () => PresenceUser[];
  getUserCount: () => number;
}

export const usePresenceStore = create<PresenceState>((set, get) => ({
  users: new Map(),

  setUsers: (users) => {
    const usersMap = new Map<string, PresenceUser>();
    for (const user of users) {
      usersMap.set(user.userId, user);
    }
    set({ users: usersMap });
  },

  addUser: (user) => {
    set((state) => {
      const newUsers = new Map(state.users);
      newUsers.set(user.userId, user);
      return { users: newUsers };
    });
  },

  removeUser: (userId) => {
    set((state) => {
      const newUsers = new Map(state.users);
      newUsers.delete(userId);
      return { users: newUsers };
    });
  },

  updateCursor: (userId, position) => {
    set((state) => {
      const user = state.users.get(userId);
      if (!user) return state;

      const newUsers = new Map(state.users);
      newUsers.set(userId, { ...user, cursorPosition: position });
      return { users: newUsers };
    });
  },

  reset: () => {
    set({ users: new Map() });
  },

  getUserList: () => {
    return Array.from(get().users.values());
  },

  getUserCount: () => {
    return get().users.size;
  },
}));
