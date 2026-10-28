/**
 * Frontend Tests for Google Sign-In Button
 * Tests button rendering, URL, and redirect behavior
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';

// Mock the useCurrentUser hook
vi.mock('@/hooks/useUsers', () => ({
  useCurrentUser: vi.fn(),
}));

// Mock socket initialization and event subscription
vi.mock('@/lib/socket', () => ({
  initializeSocket: vi.fn(),
  connectSocket: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
}));

// Stub views and panels that fetch data, so shell tests never hit the network
vi.mock('@/components/tasks/TaskTree', () => ({
  default: () => <div data-testid="task-tree">Task Tree</div>,
}));
vi.mock('@/components/summary/SummaryView', () => ({
  default: () => <div data-testid="summary-view">Summary View</div>,
}));
vi.mock('@/components/chat/NotificationPanel', () => ({
  default: () => <button>Notifications</button>,
}));
vi.mock('@/components/invites/InviteUserDialog', () => ({ default: () => null }));
vi.mock('@/components/admin/AdminSettingsModal', () => ({ default: () => null }));

// Sign out posts through the shared API client
vi.mock('@/lib/api', () => ({
  default: { post: vi.fn().mockResolvedValue({}) },
}));

import { useCurrentUser } from '@/hooks/useUsers';
import api from '@/lib/api';

const memberUser = {
  id: '1',
  email: 'test@servicebay.ai',
  name: 'Test User',
  role: 'MEMBER',
  picture: 'https://example.com/picture.jpg',
};

describe('Google Sign-In Button Tests', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    vi.clearAllMocks();
    window.location.hash = '';
  });

  describe('Sign-In Button Rendering', () => {
    it('should render sign-in button when user is not authenticated', () => {
      vi.mocked(useCurrentUser).mockReturnValue({
        data: null,
        isLoading: false,
        isError: true,
      } as any);

      render(
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      );

      const signInButton = screen.getByText('Sign in with Google');
      expect(signInButton).toBeInTheDocument();
    });

    it('should have correct href pointing to Google OAuth endpoint', () => {
      vi.mocked(useCurrentUser).mockReturnValue({
        data: null,
        isLoading: false,
        isError: true,
      } as any);

      render(
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      );

      const signInButton = screen.getByText('Sign in with Google') as HTMLAnchorElement;
      expect(signInButton.tagName).toBe('A');
      expect(signInButton.href).toContain('/api/auth/google');
    });

    it('should display welcome message with sign-in button', () => {
      vi.mocked(useCurrentUser).mockReturnValue({
        data: null,
        isLoading: false,
        isError: true,
      } as any);

      render(
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      );

      expect(screen.getByText('Welcome to E-Z')).toBeInTheDocument();
      expect(screen.getByText('Please sign in to continue')).toBeInTheDocument();
      expect(screen.getByText('Sign in with Google')).toBeInTheDocument();
    });
  });

  describe('Sign-In Button Redirect', () => {
    it('should redirect to /api/auth/google when clicked', () => {
      vi.mocked(useCurrentUser).mockReturnValue({
        data: null,
        isLoading: false,
        isError: true,
      } as any);

      render(
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      );

      const signInButton = screen.getByText('Sign in with Google') as HTMLAnchorElement;

      // Verify the button is a link that will navigate
      expect(signInButton.getAttribute('href')).toBe('/api/auth/google');

      // Verify it's an anchor tag (will cause browser navigation)
      expect(signInButton.tagName).toBe('A');
    });

    it('should have proper styling for sign-in button', () => {
      vi.mocked(useCurrentUser).mockReturnValue({
        data: null,
        isLoading: false,
        isError: true,
      } as any);

      render(
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      );

      const signInButton = screen.getByText('Sign in with Google');

      // Check if button has appropriate classes
      expect(signInButton.className).toContain('bg-primary');
      expect(signInButton.className).toContain('hover:bg-primary/90');
    });
  });

  describe('Loading State', () => {
    it('should show loading state while checking authentication', () => {
      vi.mocked(useCurrentUser).mockReturnValue({
        data: null,
        isLoading: true,
        isError: false,
      } as any);

      render(
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      );

      expect(screen.getByText('Loading...')).toBeInTheDocument();
      expect(screen.queryByText('Sign in with Google')).not.toBeInTheDocument();
    });
  });

  describe('Authenticated State', () => {
    const renderAs = (user: typeof memberUser) => {
      vi.mocked(useCurrentUser).mockReturnValue({
        data: user,
        isLoading: false,
        isError: false,
      } as any);

      return render(
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      );
    };

    it('should not show sign-in button when user is authenticated', async () => {
      renderAs(memberUser);

      expect(screen.queryByText('Sign in with Google')).not.toBeInTheDocument();
      expect(screen.getAllByText('E-Z').length).toBeGreaterThan(0);
      expect(screen.getByText('Test User')).toBeInTheDocument();
      // Let the lazily loaded dashboard settle before the test ends
      expect(await screen.findByTestId('summary-view')).toBeInTheDocument();
    });

    it('should show user info and sign out with a POST from the account menu', async () => {
      renderAs(memberUser);

      expect(screen.getByText('Test User')).toBeInTheDocument();
      expect(screen.getByText('Member')).toBeInTheDocument();

      fireEvent.keyDown(screen.getByRole('button', { name: 'Account menu' }), { key: 'Enter' });
      fireEvent.click(screen.getByRole('menuitem', { name: 'Sign out' }));

      // The server only ends the session on POST; a GET link would not sign out
      await waitFor(() => expect(api.post).toHaveBeenCalledWith('/api/auth/logout'));
    });

    it('should open on the dashboard and switch views from the sidebar', async () => {
      renderAs(memberUser);

      expect(await screen.findByTestId('summary-view')).toBeInTheDocument();

      const [tasksLink] = screen.getAllByRole('button', { name: /^Tasks$/ });
      fireEvent.click(tasksLink);

      expect(await screen.findByTestId('task-tree')).toBeInTheDocument();
      expect(window.location.hash).toBe('#/tasks');
    });

    it('should restore the view from the URL hash', async () => {
      window.location.hash = '#/tasks';
      renderAs(memberUser);

      expect(await screen.findByTestId('task-tree')).toBeInTheDocument();
    });

    it('should hide the admin-only Team view from members', async () => {
      window.location.hash = '#/team';
      renderAs(memberUser);

      expect(screen.queryByRole('button', { name: /^Team$/ })).not.toBeInTheDocument();
      // Falls back to the dashboard instead of opening the admin view
      expect(await screen.findByTestId('summary-view')).toBeInTheDocument();
    });

    it('should show the Team view to admins', () => {
      renderAs({ ...memberUser, role: 'ADMIN' });

      expect(screen.getAllByRole('button', { name: /^Team$/ }).length).toBeGreaterThan(0);
    });
  });
});

describe('Sign-in error message', () => {
  it('should explain a failed sign-in', () => {
    // happy-dom's history.replaceState doesn't update location.search
    const happyDOM = (window as any).happyDOM;
    const originalUrl = window.location.href;
    happyDOM.setURL(new URL('/login?error=auth_failed', originalUrl).href);
    vi.mocked(useCurrentUser).mockReturnValue({
      data: null,
      isLoading: false,
      isError: true,
    } as any);

    render(
      <QueryClientProvider client={new QueryClient()}>
        <App />
      </QueryClientProvider>
    );

    expect(screen.getByRole('alert')).toHaveTextContent("Sign-in didn't work");
    happyDOM.setURL(originalUrl);
  });
});

describe('Public landing navigation', () => {
  it('links the sign-in screen back to the public product page', () => {
    vi.mocked(useCurrentUser).mockReturnValue({
      data: null,
      isLoading: false,
      isError: true,
    } as any);
    render(
      <QueryClientProvider client={new QueryClient()}>
        <App />
      </QueryClientProvider>
    );
    expect(screen.getByRole('link', { name: 'Explore the product tour' }))
      .toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: 'Sign in with Google' }))
      .toHaveAttribute('href', '/api/auth/google');
  });
});
