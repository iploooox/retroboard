import { describe, it, expect, beforeEach } from 'vitest';
import { usePresenceStore } from '@/stores/presence';

describe('usePresenceStore', () => {
  beforeEach(() => {
    usePresenceStore.getState().reset();
  });

  it('should initialize with empty users', () => {
    const { getUserCount } = usePresenceStore.getState();
    expect(getUserCount()).toBe(0);
  });

  it('should add a user', () => {
    const { addUser, getUserCount, getUserList } = usePresenceStore.getState();

    addUser({
      userId: 'user-1',
      userName: 'Alice',
      userAvatar: 'https://example.com/alice.jpg',
      connectedAt: '2026-02-15T10:00:00Z',
      cursorPosition: null,
    });

    expect(getUserCount()).toBe(1);
    expect(getUserList()[0]?.userName).toBe('Alice');
  });

  it('should remove a user', () => {
    const { addUser, removeUser, getUserCount } = usePresenceStore.getState();

    addUser({
      userId: 'user-1',
      userName: 'Alice',
      userAvatar: 'https://example.com/alice.jpg',
      connectedAt: '2026-02-15T10:00:00Z',
      cursorPosition: null,
    });

    expect(getUserCount()).toBe(1);

    removeUser('user-1');

    expect(getUserCount()).toBe(0);
  });

  it('should update cursor position', () => {
    const { addUser, updateCursor, getUserList } = usePresenceStore.getState();

    addUser({
      userId: 'user-1',
      userName: 'Alice',
      userAvatar: 'https://example.com/alice.jpg',
      connectedAt: '2026-02-15T10:00:00Z',
      cursorPosition: null,
    });

    updateCursor('user-1', { x: 100, y: 200 });

    const users = getUserList();
    expect(users[0]?.cursorPosition).toEqual({ x: 100, y: 200 });
  });

  it('should reset store', () => {
    const { addUser, reset, getUserCount } = usePresenceStore.getState();

    addUser({
      userId: 'user-1',
      userName: 'Alice',
      userAvatar: 'https://example.com/alice.jpg',
      connectedAt: '2026-02-15T10:00:00Z',
      cursorPosition: null,
    });

    expect(getUserCount()).toBe(1);

    reset();

    expect(getUserCount()).toBe(0);
  });
});
