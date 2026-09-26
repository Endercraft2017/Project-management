/**
 * Chat View Component Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { render } from '../../client/src/test/utils';
import ChatView from '../../client/src/components/chat/ChatView';

vi.mock('../../client/src/hooks/useConversations');
vi.mock('../../client/src/hooks/useMessages');
vi.mock('../../client/src/lib/socket');

describe('ChatView', () => {
  it('should render chat interface', () => {
    render(<ChatView />);
    expect(screen.getByText('Messages')).toBeInTheDocument();
  });
});
