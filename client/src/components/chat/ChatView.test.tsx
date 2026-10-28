import { render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import ChatView from './ChatView';
const fixture = vi.hoisted(() => ({
  refetch: vi.fn(),
  globalListener: vi.fn(),
  listeners: new Set<(...args: unknown[]) => unknown>(),
  connect: vi.fn(),
  disconnect: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
}));
vi.mock('@/hooks/useConversations', () => ({
  useConversations: () => ({ data: [], refetch: fixture.refetch }),
}));
vi.mock('@/hooks/useUsers', () => ({
  useCurrentUser: () => ({ data: undefined }),
}));
vi.mock('@/lib/socket', () => ({
  connectSocket: fixture.connect,
  disconnectSocket: fixture.disconnect,
  on: fixture.on,
  off: fixture.off,
}));
vi.mock('./ConversationList', () => ({ default: () => null }));
vi.mock('./MessageList', () => ({ default: () => null }));
vi.mock('./MessageInput', () => ({ default: () => null }));
vi.mock('./MessageSearch', () => ({ default: () => null }));
vi.mock('./ThreadSidebar', () => ({ default: () => null }));
vi.mock('./NewMessageDialog', () => ({ default: () => null }));
afterEach(() => {
  vi.clearAllMocks();
  fixture.listeners.clear();
});
it('leaving chat retains the shared connection and another screen notification listener', () => {
  fixture.listeners.add(fixture.globalListener);
  fixture.on.mockImplementation((_event, fn) => fixture.listeners.add(fn));
  fixture.off.mockImplementation((_event, fn) =>
    fn ? fixture.listeners.delete(fn) : fixture.listeners.clear(),
  );
  const view = render(<ChatView />);
  const callback = fixture.on.mock.calls[0][1];
  expect(fixture.listeners.has(callback)).toBe(true);
  view.unmount();
  expect(fixture.off).toHaveBeenCalledWith('new_message', callback);
  expect(fixture.disconnect).not.toHaveBeenCalled();
  expect(fixture.listeners.has(fixture.globalListener)).toBe(true);
  expect(fixture.listeners.has(callback)).toBe(false);
});
