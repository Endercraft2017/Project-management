import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { Message } from '@/hooks/useMessages';
import ThreadSidebar from './ThreadSidebar';

const transport = vi.hoisted(() => ({
  connected: true,
  emit: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
  replies: [] as unknown[],
}));
vi.mock('@/lib/socket', () => ({ getSocket: () => transport }));
vi.mock('@/hooks/useUsers', () => ({
  useCurrentUser: () => ({ data: { id: 'me' } }),
}));
vi.mock('./MessageReactions', () => ({ default: () => null }));
vi.mock('./ReactionPicker', () => ({ default: () => null }));
vi.mock('../tasks/TaskDetailModal', () => ({ default: () => null }));
vi.mock('./MentionHighlight', () => ({
  default: ({ content }: { content: string }) => <span>{content}</span>,
}));
vi.mock('./MentionInputV2', () => ({
  default: ({
    value,
    onChange,
    disabled,
  }: {
    value: string;
    onChange: (value: string) => void;
    disabled: boolean;
  }) => (
    <textarea
      aria-label="Reply draft"
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));
const parent = {
  id: 'parent-a',
  conversationId: 'conversation',
  content: 'Parent',
  senderId: 'me',
  createdAt: '2026-10-28T00:00:00Z',
  updatedAt: '2026-10-28T00:00:00Z',
  threadRepliesCount: 0,
  isDeleted: false,
  isEdited: false,
} satisfies Message;
let acknowledgement: ((response: unknown) => void) | undefined;
beforeEach(() => {
  vi.clearAllMocks();
  transport.connected = true;
  transport.replies = [];
  acknowledgement = undefined;
  vi.spyOn(Element.prototype, 'scrollIntoView').mockImplementation(() => {});
  transport.emit.mockImplementation((event, _data, callback) => {
    if (event === 'get_thread_replies')
      callback({ success: true, data: { replies: transport.replies } });
    else acknowledgement = callback;
  });
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});
async function openThread() {
  const view = render(
    <ThreadSidebar parentMessage={parent} onClose={() => {}} />,
  );
  await screen.findByText('No replies yet');
  return view;
}
function draft(value: string) {
  fireEvent.change(screen.getByLabelText('Reply draft'), { target: { value } });
}
it('retains a rejected reply and prevents duplicate sends until positive confirmation', async () => {
  await openThread();
  draft('Keep my reply');
  fireEvent.click(screen.getByTitle('Send reply'));
  fireEvent.click(screen.getByTitle('Send reply'));
  expect(
    transport.emit.mock.calls.filter(
      ([event]) => event === 'send_thread_reply',
    ),
  ).toHaveLength(1);
  expect(screen.getByLabelText('Reply draft')).toHaveValue('Keep my reply');
  await act(async () =>
    acknowledgement?.({ success: false, error: 'Not permitted' }),
  );
  expect(screen.getByRole('alert')).toHaveTextContent('Not permitted');
  expect(screen.getByLabelText('Reply draft')).toHaveValue('Keep my reply');
  fireEvent.click(screen.getByTitle('Send reply'));
  await act(async () =>
    acknowledgement?.({
      success: true,
      data: { ...parent, id: 'reply', content: 'Keep my reply' },
    }),
  );
  expect(screen.getByLabelText('Reply draft')).toHaveValue('');
  expect(screen.getByText('Keep my reply')).toBeInTheDocument();
});
it('keeps a timed-out draft and restores the send button', async () => {
  await openThread();
  vi.useFakeTimers();
  draft('Unconfirmed reply');
  fireEvent.click(screen.getByTitle('Send reply'));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(10000);
  });
  expect(screen.getByRole('alert')).toHaveTextContent(
    'Check the thread before retrying',
  );
  expect(screen.getByLabelText('Reply draft')).toHaveValue('Unconfirmed reply');
  expect(screen.getByTitle('Send reply')).not.toBeDisabled();
});
it('keeps a failed edit until a successful edit acknowledgement', async () => {
  transport.replies = [{ ...parent, id: 'reply', content: 'Original' }];
  render(<ThreadSidebar parentMessage={parent} onClose={() => {}} />);
  const original = await screen.findByText('Original');
  fireEvent.mouseEnter(original.closest('.group')!);
  fireEvent.click(screen.getByTitle('Edit message'));
  draft('Corrected');
  fireEvent.click(screen.getByTitle('Send reply'));
  expect(transport.emit).toHaveBeenLastCalledWith(
    'edit_message',
    { messageId: 'reply', content: 'Corrected' },
    expect.any(Function),
  );
  await act(async () =>
    acknowledgement?.({ success: false, error: 'Try later' }),
  );
  expect(screen.getByText('Editing message')).toBeInTheDocument();
  expect(screen.getByLabelText('Reply draft')).toHaveValue('Corrected');
  fireEvent.click(screen.getByTitle('Send reply'));
  await act(async () =>
    acknowledgement?.({
      success: true,
      data: { ...parent, id: 'reply', content: 'Corrected', isEdited: true },
    }),
  );
  expect(screen.queryByText('Editing message')).not.toBeInTheDocument();
  expect(screen.getByLabelText('Reply draft')).toHaveValue('');
  expect(screen.getByText('Corrected')).toBeInTheDocument();
});
it('a late acknowledgement cannot erase the next thread draft', async () => {
  const view = await openThread();
  draft('Thread A');
  fireEvent.click(screen.getByTitle('Send reply'));
  const finishA = acknowledgement;
  view.rerender(
    <ThreadSidebar
      parentMessage={{ ...parent, id: 'parent-b' }}
      onClose={() => {}}
    />,
  );
  await screen.findByText('No replies yet');
  draft('Thread B');
  await act(async () =>
    finishA?.({
      success: true,
      data: { ...parent, id: 'reply-a', content: 'Thread A' },
    }),
  );
  expect(screen.getByLabelText('Reply draft')).toHaveValue('Thread B');
  expect(screen.queryByText('Thread A')).not.toBeInTheDocument();
});
it('distinguishes unavailable thread loading from an empty thread and allows retry', async () => {
  transport.connected = false;
  render(<ThreadSidebar parentMessage={parent} onClose={() => {}} />);
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Connection unavailable',
  );
  expect(screen.queryByText('No replies yet')).not.toBeInTheDocument();
  transport.connected = true;
  fireEvent.click(screen.getByText('Retry loading replies'));
  await waitFor(() =>
    expect(screen.getByText('No replies yet')).toBeInTheDocument(),
  );
});
