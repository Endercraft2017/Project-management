/**
 * Task View Component Tests
 * Tests for TaskTree, TaskNode, TaskForm, and TaskFilters
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render, createMockUser, createMockTask, createMockSprint } from '../../client/src/test/utils';
import TaskTree from '../../client/src/components/tasks/TaskTree';
import TaskNode from '../../client/src/components/tasks/TaskNode';
import TaskForm from '../../client/src/components/tasks/TaskForm';
import TaskFilters from '../../client/src/components/tasks/TaskFilters';

// Mock hooks
vi.mock('../../client/src/hooks/useTasks');
vi.mock('../../client/src/hooks/useUsers');
vi.mock('../../client/src/hooks/useSprints');

import * as useTasks from '../../client/src/hooks/useTasks';
import * as useUsers from '../../client/src/hooks/useUsers';
import * as useSprints from '../../client/src/hooks/useSprints';

describe('TaskFilters Component', () => {
  const mockUser = createMockUser();
  const mockSprint = createMockSprint();

  beforeEach(() => {
    vi.mocked(useUsers.useUsers).mockReturnValue({
      data: { data: [mockUser], pagination: { total: 1, page: 1, limit: 10, totalPages: 1 } },
      isLoading: false,
      isError: false,
    } as any);

    vi.mocked(useSprints.useSprints).mockReturnValue({
      data: { data: [mockSprint], pagination: { total: 1, page: 1, limit: 10, totalPages: 1 } },
      isLoading: false,
      isError: false,
    } as any);
  });

  it('should render search input', () => {
    const mockOnFiltersChange = vi.fn();
    render(<TaskFilters filters={{}} onFiltersChange={mockOnFiltersChange} />);

    expect(screen.getByPlaceholderText('Search tasks...')).toBeInTheDocument();
  });

  it('should call onFiltersChange when search input changes', async () => {
    const user = userEvent.setup();
    const mockOnFiltersChange = vi.fn();
    render(<TaskFilters filters={{}} onFiltersChange={mockOnFiltersChange} />);

    const searchInput = screen.getByPlaceholderText('Search tasks...');
    await user.type(searchInput, 'test');

    expect(mockOnFiltersChange).toHaveBeenCalled();
  });

  it('should display filter panel when Filters button is clicked', async () => {
    const user = userEvent.setup();
    const mockOnFiltersChange = vi.fn();
    render(<TaskFilters filters={{}} onFiltersChange={mockOnFiltersChange} />);

    const filtersButton = screen.getByText('Filters');
    await user.click(filtersButton);

    expect(screen.getByText('Sprint')).toBeInTheDocument();
    expect(screen.getByText('Assigned To')).toBeInTheDocument();
  });

  it('should show active filter count badge', () => {
    const mockOnFiltersChange = vi.fn();
    render(<TaskFilters filters={{ sprintId: 'sprint-1', assignedToId: 'user-1' }} onFiltersChange={mockOnFiltersChange} />);

    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('should clear all filters when Clear all is clicked', async () => {
    const user = userEvent.setup();
    const mockOnFiltersChange = vi.fn();
    render(<TaskFilters filters={{ search: 'test', sprintId: 'sprint-1' }} onFiltersChange={mockOnFiltersChange} />);

    const filtersButton = screen.getByText('Filters');
    await user.click(filtersButton);

    const clearButton = screen.getByText('Clear all');
    await user.click(clearButton);

    expect(mockOnFiltersChange).toHaveBeenCalledWith({});
  });
});

describe('TaskForm Component', () => {
  const mockUser = createMockUser();
  const mockSprint = createMockSprint();
  const mockTask = createMockTask();

  beforeEach(() => {
    vi.mocked(useUsers.useUsers).mockReturnValue({
      data: { data: [mockUser], pagination: { total: 1, page: 1, limit: 10, totalPages: 1 } },
      isLoading: false,
      isError: false,
    } as any);

    vi.mocked(useSprints.useSprints).mockReturnValue({
      data: { data: [mockSprint], pagination: { total: 1, page: 1, limit: 10, totalPages: 1 } },
      isLoading: false,
      isError: false,
    } as any);

    vi.mocked(useTasks.useCreateTask).mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue(mockTask),
      isPending: false,
    } as any);

    vi.mocked(useTasks.useUpdateTask).mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue(mockTask),
      isPending: false,
    } as any);

    vi.mocked(useTasks.useCreateSubtask).mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue(mockTask),
      isPending: false,
    } as any);
  });

  it('should render create task form', () => {
    const mockOnClose = vi.fn();
    render(<TaskForm onClose={mockOnClose} />);

    expect(screen.getByText('Create Task')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter task name')).toBeInTheDocument();
  });

  it('should render edit task form with existing data', () => {
    const mockOnClose = vi.fn();
    render(<TaskForm task={mockTask} onClose={mockOnClose} />);

    expect(screen.getByText('Edit Task')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Test Task')).toBeInTheDocument();
  });

  it('should show validation errors for required fields', async () => {
    const user = userEvent.setup();
    const mockOnClose = vi.fn();
    render(<TaskForm onClose={mockOnClose} />);

    const submitButton = screen.getByRole('button', { name: /create/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Task name is required')).toBeInTheDocument();
    });
  });

  it('should validate deadline is after start date', async () => {
    const user = userEvent.setup();
    const mockOnClose = vi.fn();
    render(<TaskForm onClose={mockOnClose} />);

    const startDateInput = screen.getByLabelText(/start date/i);
    const deadlineInput = screen.getByLabelText(/deadline/i);

    await user.clear(startDateInput);
    await user.type(startDateInput, '2025-12-31');

    await user.clear(deadlineInput);
    await user.type(deadlineInput, '2025-01-01');

    const submitButton = screen.getByRole('button', { name: /create/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Deadline must be after start date')).toBeInTheDocument();
    });
  });

  it('should call onClose when Cancel is clicked', async () => {
    const user = userEvent.setup();
    const mockOnClose = vi.fn();
    render(<TaskForm onClose={mockOnClose} />);

    const cancelButton = screen.getByRole('button', { name: /cancel/i });
    await user.click(cancelButton);

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should display progress slider when editing task', () => {
    const mockOnClose = vi.fn();
    render(<TaskForm task={mockTask} onClose={mockOnClose} />);

    expect(screen.getByText(/progress:/i)).toBeInTheDocument();
  });

  it('should show inherited sprint message for subtasks', () => {
    const mockOnClose = vi.fn();
    const parentTask = createMockTask({ id: 'parent-1' });
    render(<TaskForm parentTask={parentTask} onClose={mockOnClose} />);

    expect(screen.getByText(/inherited from parent/i)).toBeInTheDocument();
  });
});

describe('TaskNode Component', () => {
  const mockUser = createMockUser();
  const mockTask = createMockTask({ assignedTo: mockUser });
  const mockOnEdit = vi.fn();
  const mockOnCreateSubtask = vi.fn();

  beforeEach(() => {
    vi.mocked(useUsers.useCurrentUser).mockReturnValue({
      data: mockUser,
      isLoading: false,
      isError: false,
    } as any);

    vi.mocked(useTasks.useDeleteTask).mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue({}),
      isPending: false,
    } as any);

    vi.mocked(useTasks.useUpdateTaskProgress).mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue(mockTask),
      isPending: false,
    } as any);
  });

  it('should render task name and details', () => {
    render(
      <TaskNode
        task={mockTask}
        level={0}
        onEdit={mockOnEdit}
        onCreateSubtask={mockOnCreateSubtask}
      />
    );

    expect(screen.getByText('Test Task')).toBeInTheDocument();
    expect(screen.getByText('Test task details')).toBeInTheDocument();
  });

  it('should show assignee name', () => {
    render(
      <TaskNode
        task={mockTask}
        level={0}
        onEdit={mockOnEdit}
        onCreateSubtask={mockOnCreateSubtask}
      />
    );

    expect(screen.getByText('Test User')).toBeInTheDocument();
  });

  it('should show progress percentage', () => {
    const taskWithProgress = createMockTask({ progress: 50 });
    render(
      <TaskNode
        task={taskWithProgress}
        level={0}
        onEdit={mockOnEdit}
        onCreateSubtask={mockOnCreateSubtask}
      />
    );

    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('should call onEdit when edit button is clicked', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <TaskNode
        task={mockTask}
        level={0}
        onEdit={mockOnEdit}
        onCreateSubtask={mockOnCreateSubtask}
      />
    );

    // Hover to show action buttons
    const taskRow = container.querySelector('.group');
    if (taskRow) {
      await user.hover(taskRow);
    }

    const editButton = screen.getByTitle('Edit Task');
    await user.click(editButton);

    expect(mockOnEdit).toHaveBeenCalledWith(mockTask);
  });

  it('should call onCreateSubtask when add subtask button is clicked', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <TaskNode
        task={mockTask}
        level={0}
        onEdit={mockOnEdit}
        onCreateSubtask={mockOnCreateSubtask}
      />
    );

    const taskRow = container.querySelector('.group');
    if (taskRow) {
      await user.hover(taskRow);
    }

    const addButton = screen.getByTitle('Add Subtask');
    await user.click(addButton);

    expect(mockOnCreateSubtask).toHaveBeenCalledWith(mockTask);
  });

  it('should not show add subtask button at max nesting level (3)', () => {
    const taskAtLevel3 = createMockTask({ nestingLevel: 3 });
    render(
      <TaskNode
        task={taskAtLevel3}
        level={3}
        onEdit={mockOnEdit}
        onCreateSubtask={mockOnCreateSubtask}
      />
    );

    expect(screen.queryByTitle('Add Subtask')).not.toBeInTheDocument();
  });

  it('should show subtask count when task has subtasks', () => {
    const subtask = createMockTask({ id: 'subtask-1', parentTaskId: 'task-1' });
    const taskWithSubtasks = createMockTask({ subtasks: [subtask] });

    render(
      <TaskNode
        task={taskWithSubtasks}
        level={0}
        onEdit={mockOnEdit}
        onCreateSubtask={mockOnCreateSubtask}
      />
    );

    expect(screen.getByText('(1 subtask)')).toBeInTheDocument();
  });

  it('should expand/collapse subtasks when chevron is clicked', async () => {
    const user = userEvent.setup();
    const subtask = createMockTask({ id: 'subtask-1', taskName: 'Subtask 1', parentTaskId: 'task-1' });
    const taskWithSubtasks = createMockTask({ subtasks: [subtask] });

    render(
      <TaskNode
        task={taskWithSubtasks}
        level={0}
        onEdit={mockOnEdit}
        onCreateSubtask={mockOnCreateSubtask}
      />
    );

    // Subtasks should be visible initially (auto-expand at level 0-1)
    expect(screen.getByText('Subtask 1')).toBeInTheDocument();

    // Click to collapse
    const chevronButton = screen.getByRole('button', { name: '' });
    await user.click(chevronButton);

    // Subtask should be hidden
    await waitFor(() => {
      expect(screen.queryByText('Subtask 1')).not.toBeInTheDocument();
    });
  });
});

describe('TaskTree Component', () => {
  const mockUser = createMockUser({ role: 'ADMIN' });
  const mockTask = createMockTask();

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
  });

  it('should render Tasks header', () => {
    render(<TaskTree />);

    expect(screen.getByText('Tasks')).toBeInTheDocument();
    expect(screen.getByText('Manage your tasks and subtasks')).toBeInTheDocument();
  });

  it('should show New Task button for authorized users', () => {
    render(<TaskTree />);

    expect(screen.getByRole('button', { name: /new task/i })).toBeInTheDocument();
  });

  it('should show loading state', () => {
    vi.mocked(useTasks.useTasks).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    } as any);

    render(<TaskTree />);

    expect(screen.getByRole('img', { hidden: true })).toHaveClass('animate-spin');
  });

  it('should show error state', () => {
    vi.mocked(useTasks.useTasks).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: vi.fn(),
    } as any);

    render(<TaskTree />);

    expect(screen.getByText('Failed to load tasks. Please try again.')).toBeInTheDocument();
  });

  it('should show empty state when no tasks', () => {
    vi.mocked(useTasks.useTasks).mockReturnValue({
      data: { data: [], pagination: { total: 0, page: 1, limit: 10, totalPages: 0 } },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);

    render(<TaskTree />);

    expect(screen.getByText('No tasks yet')).toBeInTheDocument();
  });

  it('should render task list when tasks are available', () => {
    render(<TaskTree />);

    expect(screen.getByText('Test Task')).toBeInTheDocument();
  });

  it('should open task form when New Task is clicked', async () => {
    const user = userEvent.setup();
    render(<TaskTree />);

    const newTaskButton = screen.getByRole('button', { name: /new task/i });
    await user.click(newTaskButton);

    await waitFor(() => {
      expect(screen.getByText('Create Task')).toBeInTheDocument();
    });
  });

  it('should filter tasks by search term', async () => {
    const task1 = createMockTask({ id: 'task-1', taskName: 'Frontend Task' });
    const task2 = createMockTask({ id: 'task-2', taskName: 'Backend Task' });

    vi.mocked(useTasks.useTasks).mockReturnValue({
      data: { data: [task1, task2], pagination: { total: 2, page: 1, limit: 10, totalPages: 1 } },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);

    render(<TaskTree />);

    // Both tasks should be visible initially
    expect(screen.getByText('Frontend Task')).toBeInTheDocument();
    expect(screen.getByText('Backend Task')).toBeInTheDocument();

    // Type search term
    const user = userEvent.setup();
    const searchInput = screen.getByPlaceholderText('Search tasks...');
    await user.type(searchInput, 'Frontend');

    // Only matching task should be visible
    await waitFor(() => {
      expect(screen.getByText('Frontend Task')).toBeInTheDocument();
      expect(screen.queryByText('Backend Task')).not.toBeInTheDocument();
    });
  });
});
