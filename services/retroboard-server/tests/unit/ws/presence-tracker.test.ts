import { describe, it, expect, beforeEach } from 'vitest';
import { PresenceTracker } from '../../../src/ws/presence-tracker.js';

describe('PresenceTracker', () => {
  let pt: PresenceTracker;

  const userInfo = (id: string) => ({
    userId: id,
    userName: `User ${id}`,
    userAvatar: `https://example.com/avatar/${id}.jpg`,
  });

  beforeEach(() => {
    pt = new PresenceTracker();
  });

  it('3.2.1: addUser returns true for new user', () => {
    const isNew = pt.addUser('board-1', 'user-1', userInfo('user-1'));
    expect(isNew).toBe(true);
  });

  it('3.2.2: addUser returns false for duplicate user (second tab)', () => {
    pt.addUser('board-1', 'user-1', userInfo('user-1'));
    const isNew = pt.addUser('board-1', 'user-1', userInfo('user-1'));
    expect(isNew).toBe(false);
  });

  it('3.2.3: removeUser returns true when last connection', () => {
    pt.addUser('board-1', 'user-1', userInfo('user-1'));
    const isGone = pt.removeUser('board-1', 'user-1');
    expect(isGone).toBe(true);
    expect(pt.getUsers('board-1')).toHaveLength(0);
  });

  it('3.2.4: removeUser returns false when connections remain', () => {
    pt.addUser('board-1', 'user-1', userInfo('user-1'));
    pt.addUser('board-1', 'user-1', userInfo('user-1')); // second tab
    const isGone = pt.removeUser('board-1', 'user-1');
    expect(isGone).toBe(false);
  });

  it('3.2.5: getUsers returns all users for board', () => {
    pt.addUser('board-1', 'u1', userInfo('u1'));
    pt.addUser('board-1', 'u2', userInfo('u2'));
    pt.addUser('board-1', 'u3', userInfo('u3'));
    const users = pt.getUsers('board-1');
    expect(users).toHaveLength(3);
  });

  it('3.2.6: getUsers returns empty for unknown board', () => {
    const users = pt.getUsers('unknown-board');
    expect(users).toHaveLength(0);
  });

  it('3.2.7: updateCursor updates position', () => {
    pt.addUser('board-1', 'user-1', userInfo('user-1'));
    pt.updateCursor('board-1', 'user-1', { x: 10, y: 20 });
    const users = pt.getUsers('board-1');
    const user = users.find((u) => u.userId === 'user-1');
    expect(user?.cursorPosition).toEqual({ x: 10, y: 20 });
  });

  it('3.2.8: isUserOnline returns true for connected user', () => {
    pt.addUser('board-1', 'user-1', userInfo('user-1'));
    expect(pt.isUserOnline('board-1', 'user-1')).toBe(true);
  });

  it('3.2.9: isUserOnline returns false for disconnected user', () => {
    expect(pt.isUserOnline('board-1', 'user-99')).toBe(false);
  });

  it('3.2.10: Multi-tab: third tab increments connectionCount', () => {
    pt.addUser('board-1', 'user-1', userInfo('user-1'));
    pt.addUser('board-1', 'user-1', userInfo('user-1'));
    pt.addUser('board-1', 'user-1', userInfo('user-1'));
    // User should still appear once in the list
    const users = pt.getUsers('board-1');
    expect(users).toHaveLength(1);
    // But removing twice should still keep user present
    pt.removeUser('board-1', 'user-1');
    pt.removeUser('board-1', 'user-1');
    expect(pt.isUserOnline('board-1', 'user-1')).toBe(true);
  });

  it('3.2.11: Multi-tab: close one tab decrements count', () => {
    pt.addUser('board-1', 'user-1', userInfo('user-1'));
    pt.addUser('board-1', 'user-1', userInfo('user-1'));
    pt.addUser('board-1', 'user-1', userInfo('user-1'));
    // Close one tab
    const isGone = pt.removeUser('board-1', 'user-1');
    expect(isGone).toBe(false);
    expect(pt.isUserOnline('board-1', 'user-1')).toBe(true);
  });
});
