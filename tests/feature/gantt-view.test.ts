/**
 * Gantt View Component Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render, createMockUser, createMockTask, createMockSprint } from '../../client/src/test/utils';
import GanttView from '../../client/src/components/gantt/GanttView';
import GanttToolbar from '../../client/src/components/gantt/GanttToolbar';
import TaskDetailsPanel from '../../client/src/components/gantt/TaskDetailsPanel';

// Mock hooks
vi.mock('../../client/src/hooks/useTasks');
vi.mock('../../client/src/hooks/useUsers');
vi.mock('../../client/src/hooks/useSprints');

// Mock Frappe Gantt
vi.mock('frappe-gantt', () => ({
  default: vi.fn().mockImplementation(() => ({
    change_view_mode: vi.fn(),
    refresh: vi.fn(),
  })),
}));

import * as useTasks from '../../client/src/hooks/useTasks';
import * as useUsers from '../../client/src/hooks/useUsers';
import * as useSprints from '../../client/src/hooks/useSprints';

const mockUser = createMockUser({ role: 'ADMIN' });
const mockSprint = createMockSprint();
const mockTask = createMockTask({
  sprint: mockSprint,
  assignedTo: mockUser,
  createdBy: mockUser,
});

describe('GanttToolbar Component', () => {
  beforeEach(() => {
    vi.mocked(useSprints.useSprints).mockReturnValue({
      data: { data: [mockSprint], pagination: { total: 1, page: 1, limit: 10, totalPages: 1 } },
      isLoading: false,
      isError: false,
    } as any);
  });

  it('should render view mode buttons', () => {
    const mockOnViewModeChange = vi.fn();
    const mockOnSprintChange = vi.fn();

    render(
      <GanttToolbar
        viewMode="Week"
        onViewModeChange={mockOnViewModeChange}
        onSprintChange={mockOnSprintChange}
      />
    );

    expect(screen.getByText('Day')).toBeInTheDocument();
    expect(screen.getByText('Week')).toBeInTheDocument();
    expect(screen.getByText('Month')).toBeInTheDocument();
    expect(screen.getByText('Year')).toBeInTheDocument();
  });

  it('should highlight active view mode', () => {
    const mockOnViewModeChange = vi.fn();
    const mockOnSprintChange = vi.fn();

    render(
      <GanttToolbar
        viewMode="Month"
        onViewModeChange={mockOnViewModeChange}
        onSprintChange={mockOnSprintChange}
      />
    );

    const monthButton = screen.getByText('Month');
    expect(monthButton).toHaveClass('bg-primary');
  });

  it('should call onViewModeChange when button clicked', async () => {
    const user = userEvent.setup();
    const mockOnViewModeChange = vi.fn();
    const mockOnSprintChange = vi.fn();

    render(
      <GanttToolbar
        viewMode="Week"
        onViewModeChange={mockOnViewModeChange}
        onSprintChange={mockOnSprintChange}
      />
    );

    const dayButton = screen.getByText('Day');
    await user.click(dayButton);

    expect(mockOnViewModeChange).toHaveBeenCalledWith('Day');
  });

  it('should render sprint filter dropdown', () => {
    const mockOnViewModeChange = vi.fn();
    const mockOnSprintChange = vi.fn();

    render(
      <GanttToolbar
        viewMode="Week"
        onViewModeChange={mockOnViewModeChange}
        onSprintChange={mockOnSprintChange}
      />
    );

    expect(screen.getByLabelText('Sprint:')).toBeInTheDocument();
    expect(screen.getByText('All Sprints')).toBeInTheDocument();
  });

  it('should call onSprintChange when sprint selected', async () => {
    const user = userEvent.setup();
    const mockOnViewModeChange = vi.fn();
    const mockOnSprintChange = vi.fn();

    render(
      <GanttToolbar
        viewMode="Week"
        onViewModeChange={mockOnViewModeChange}
        selectedSprint=""
        onSprintChange={mockOnSprintChange}
      />
    );

    const sprintSelect = screen.getByLabelText('Sprint:');
    await user.selectOptions(sprintSelect, mockSprint.id);

    expect(mockOnSprintChange).toHaveBeenCalledWith(mockSprint.id);
  });

  it('should render export button when onExport provided', () => {
    const mockOnViewModeChange = vi.fn();
    const mockOnSprintChange = vi.fn();
    const mockOnExport = vi.fn();

    render(
      <GanttToolbar
        viewMode="Week"
        onViewModeChange={mockOnViewModeChange}
        onSprintChange={mockOnSprintChange}
        onExport={mockOnExport}
      />
    );

    expect(screen.getByText('Export')).toBeInTheDocument();
  });
});

describe('TaskDetailsPanel Component', () => {
  it('should render task details', () => {
    const mockOnClose = vi.fn();

    render(<TaskDetailsPanel task={mockTask} onClose={mockOnClose} />);

    expect(screen.getByText(mockTask.taskName)).toBeInTheDocument();
    expect(screen.getByText(mockUser.name)).toBeInTheDocument();
    expect(screen.getByText(`${mockTask.progress}%`)).toBeInTheDocument();
  });

  it('should show sprint name', () => {
    const mockOnClose = vi.fn();

    render(<TaskDetailsPanel task={mockTask} onClose={mockOnClose} />);

    expect(screen.getByText(mockSprint.name)).toBeInTheDocument();
  });

  it('should display progress bar', () => {
    const mockOnClose = vi.fn();
    const taskWithProgress = createMockTask({ progress: 75 });

    const { container } = render(
      <TaskDetailsPanel task={taskWithProgress} onClose={mockOnClose} />
    );

    const progressBar = container.querySelector('[style*="width: 75%"]');
    expect(progressBar).toBeInTheDocument();
  });

  it('should show overdue warning for past deadline', () => {
    const mockOnClose = vi.fn();
    const overdueTask = createMockTask({
      deadline: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      progress: 50,
    });

    render(<TaskDetailsPanel task={overdueTask} onClose={mockOnClose} />);

    expect(screen.getByText(/overdue/i)).toBeInTheDocument();
  });

  it('should call onClose when close button clicked', async () => {
    const user = userEvent.setup();
    const mockOnClose = vi.fn();

    render(<TaskDetailsPanel task={mockTask} onClose={mockOnClose} />);

    const closeButton = screen.getByLabelText('Close panel');
    await user.click(closeButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should show task description if provided', () => {
    const mockOnClose = vi.fn();
    const taskWithDetails = createMockTask({ details: 'Task description here' });

    render(<TaskDetailsPanel task={taskWithDetails} onClose={mockOnClose} />);

    expect(screen.getByText('Task description here')).toBeInTheDocument();
  });
});

describe('GanttView Component', () => {
  beforeEach(() => {
    vi.mocked(useUsers.useCurrentUser).mockReturnValue({
      data: mockUser,
      isLoading: false,
      isError: false,
    } as any);

    vi.mocked(useTasks.useTasks).mockReturnValue({
      data: { data: [mockTask], pagination: { total: 1, page: 1, limit: 10, totalPages: 1 } },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);

    vi.mocked(useTasks.useUpdateTask).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    } as any);

    vi.mocked(useSprints.useSprints).mockReturnValue({
      data: { data: [mockSprint], pagination: { total: 1, page: 1, limit: 10, totalPages: 1 } },
      isLoading: false,
      isError: false,
    } as any);
  });

  it('should render Gantt chart header', () => {
    render(<GanttView />);

    expect(screen.getByText('Gantt Chart')).toBeInTheDocument();
    expect(screen.getByText('Timeline visualization of project tasks')).toBeInTheDocument();
  });

  it('should render refresh button', () => {
    render(<GanttView />);

    expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument();
  });

  it('should show loading state', () => {
    vi.mocked(useTasks.useTasks).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    } as any);

    render(<GanttView />);

    expect(screen.getByText('Loading Gantt chart...')).toBeInTheDocument();
  });

  it('should show error state', () => {
    vi.mocked(useTasks.useTasks).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: vi.fn(),
    } as any);

    render(<GanttView />);

    expect(screen.getByText('Failed to load tasks. Please try again.')).toBeInTheDocument();
  });

  it('should show read-only banner for non-admin users', () => {
    vi.mocked(useUsers.useCurrentUser).mockReturnValue({
      data: createMockUser({ role: 'MEMBER' }),
      isLoading: false,
      isError: false,
    } as any);

    render(<GanttView />);

    expect(screen.getByText(/viewing in read-only mode/i)).toBeInTheDocument();
  });

  it('should not show read-only banner for admin users', () => {
    render(<GanttView />);

    expect(screen.queryByText(/viewing in read-only mode/i)).not.toBeInTheDocument();
  });

  it('should render legend', () => {
    render(<GanttView />);

    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByText('Overdue')).toBeInTheDocument();
    expect(screen.getByText('Not Started')).toBeInTheDocument();
  });

  it('should call refetch when refresh button clicked', async () => {
    const user = userEvent.setup();
    const mockRefetch = vi.fn();

    vi.mocked(useTasks.useTasks).mockReturnValue({
      data: { data: [mockTask], pagination: { total: 1, page: 1, limit: 10, totalPages: 1 } },
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
    } as any);

    render(<GanttView />);

    const refreshButton = screen.getByRole('button', { name: /refresh/i });
    await user.click(refreshButton);

    expect(mockRefetch).toHaveBeenCalled();
  });
});
