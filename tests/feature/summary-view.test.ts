/**
 * Summary View Component Tests
 * Tests for SummaryView and chart components
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { render } from '../../client/src/test/utils';
import SummaryView from '../../client/src/components/summary/SummaryView';
import StatsCards from '../../client/src/components/summary/StatsCards';
import TasksBySprintChart from '../../client/src/components/summary/TasksBySprintChart';
import TasksByUserChart from '../../client/src/components/summary/TasksByUserChart';
import ProgressChart from '../../client/src/components/summary/ProgressChart';
import CompletionTrendChart from '../../client/src/components/summary/CompletionTrendChart';

// Mock hooks
vi.mock('../../client/src/hooks/useStatistics');

import * as useStatistics from '../../client/src/hooks/useStatistics';

const mockStatistics: useStatistics.SummaryStatistics = {
  totalTasks: 100,
  completedTasks: 75,
  completionPercentage: 75,
  overdueTasks: 5,
  inProgressTasks: 20,
  notStartedTasks: 5,
  tasksBySprint: [
    {
      sprintId: 'sprint-1',
      sprintName: 'Sprint 1',
      taskCount: 50,
      completedCount: 40,
      completionPercentage: 80,
    },
    {
      sprintId: 'sprint-2',
      sprintName: 'Sprint 2',
      taskCount: 50,
      completedCount: 35,
      completionPercentage: 70,
    },
  ],
  tasksByUser: [
    {
      userId: 'user-1',
      userName: 'John Doe',
      userEmail: 'john@example.com',
      assignedCount: 30,
      completedCount: 25,
      completionPercentage: 83,
    },
    {
      userId: 'user-2',
      userName: 'Jane Smith',
      userEmail: 'jane@example.com',
      assignedCount: 40,
      completedCount: 30,
      completionPercentage: 75,
    },
  ],
  progressDistribution: [
    { range: '0-20%', count: 5, percentage: 5 },
    { range: '21-40%', count: 10, percentage: 10 },
    { range: '41-60%', count: 10, percentage: 10 },
    { range: '61-80%', count: 15, percentage: 15 },
    { range: '81-99%', count: 10, percentage: 10 },
    { range: '100%', count: 50, percentage: 50 },
  ],
  completionTrend: [
    { date: '2025-01-01', completed: 5, created: 10 },
    { date: '2025-01-02', completed: 8, created: 5 },
    { date: '2025-01-03', completed: 10, created: 8 },
  ],
};

describe('StatsCards Component', () => {
  it('should render all stat cards', () => {
    render(
      <StatsCards
        totalTasks={100}
        completedTasks={75}
        completionPercentage={75}
        overdueTasks={5}
        inProgressTasks={20}
        notStartedTasks={5}
      />
    );

    expect(screen.getByText('Total Tasks')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('75')).toBeInTheDocument();
    expect(screen.getByText('Completion Rate')).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(screen.getByText('Overdue')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('should display correct values for each card', () => {
    render(
      <StatsCards
        totalTasks={50}
        completedTasks={25}
        completionPercentage={50}
        overdueTasks={10}
        inProgressTasks={15}
        notStartedTasks={10}
      />
    );

    expect(screen.getByText('50')).toBeInTheDocument();
    expect(screen.getByText('25')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
  });
});

describe('TasksBySprintChart Component', () => {
  it('should render chart with data', () => {
    const { container } = render(
      <TasksBySprintChart data={mockStatistics.tasksBySprint} />
    );

    // Recharts renders SVG
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('should show empty state when no data', () => {
    render(<TasksBySprintChart data={[]} />);

    expect(screen.getByText('No sprint data available')).toBeInTheDocument();
  });

  it('should render sprint names', () => {
    render(<TasksBySprintChart data={mockStatistics.tasksBySprint} />);

    expect(screen.getByText('Sprint 1')).toBeInTheDocument();
    expect(screen.getByText('Sprint 2')).toBeInTheDocument();
  });
});

describe('TasksByUserChart Component', () => {
  it('should render chart with data', () => {
    const { container } = render(
      <TasksByUserChart data={mockStatistics.tasksByUser} />
    );

    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('should show empty state when no data', () => {
    render(<TasksByUserChart data={[]} />);

    expect(screen.getByText('No user data available')).toBeInTheDocument();
  });

  it('should render user names', () => {
    render(<TasksByUserChart data={mockStatistics.tasksByUser} />);

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
  });
});

describe('ProgressChart Component', () => {
  it('should render pie chart with data', () => {
    const { container } = render(
      <ProgressChart data={mockStatistics.progressDistribution} />
    );

    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('should show empty state when no data', () => {
    render(<ProgressChart data={[]} />);

    expect(screen.getByText('No progress data available')).toBeInTheDocument();
  });

  it('should filter out zero-count ranges', () => {
    const dataWithZeros = [
      { range: '0-20%', count: 0, percentage: 0 },
      { range: '100%', count: 50, percentage: 100 },
    ];

    const { container } = render(<ProgressChart data={dataWithZeros} />);

    // Should still render chart with non-zero data
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('should show message when all counts are zero', () => {
    const dataWithAllZeros = [
      { range: '0-20%', count: 0, percentage: 0 },
      { range: '100%', count: 0, percentage: 0 },
    ];

    render(<ProgressChart data={dataWithAllZeros} />);

    expect(screen.getByText('No tasks to display')).toBeInTheDocument();
  });
});

describe('CompletionTrendChart Component', () => {
  it('should render line chart with data', () => {
    const { container } = render(
      <CompletionTrendChart data={mockStatistics.completionTrend} />
    );

    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('should show empty state when no data', () => {
    render(<CompletionTrendChart data={[]} />);

    expect(screen.getByText('No trend data available')).toBeInTheDocument();
  });

  it('should format dates correctly', () => {
    render(<CompletionTrendChart data={mockStatistics.completionTrend} />);

    // Date-fns formats as "Jan 01", etc.
    expect(screen.getByText('Jan 01')).toBeInTheDocument();
  });
});

describe('SummaryView Component', () => {
  beforeEach(() => {
    vi.mocked(useStatistics.useSummaryStatistics).mockReturnValue({
      data: mockStatistics,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);
  });

  it('should render summary dashboard header', () => {
    render(<SummaryView />);

    expect(screen.getByText('Summary Dashboard')).toBeInTheDocument();
    expect(
      screen.getByText('Overview of project progress and team workload')
    ).toBeInTheDocument();
  });

  it('should render all chart sections', () => {
    render(<SummaryView />);

    expect(screen.getByText('Tasks by Sprint')).toBeInTheDocument();
    expect(screen.getByText('Team Workload')).toBeInTheDocument();
    expect(screen.getByText('Progress Distribution')).toBeInTheDocument();
    expect(screen.getByText('30-Day Completion Trend')).toBeInTheDocument();
  });

  it('should show loading state', () => {
    vi.mocked(useStatistics.useSummaryStatistics).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    } as any);

    render(<SummaryView />);

    expect(screen.getByText('Loading statistics...')).toBeInTheDocument();
  });

  it('should show error state', () => {
    vi.mocked(useStatistics.useSummaryStatistics).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: vi.fn(),
    } as any);

    render(<SummaryView />);

    expect(
      screen.getByText('Failed to load statistics. Please try again.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('should render insights section', () => {
    render(<SummaryView />);

    expect(screen.getByText('Insights')).toBeInTheDocument();
    expect(screen.getByText('Active Sprints')).toBeInTheDocument();
    expect(screen.getByText('Team Members')).toBeInTheDocument();
    expect(screen.getByText('Avg. Tasks per User')).toBeInTheDocument();
  });

  it('should calculate average tasks per user correctly', () => {
    render(<SummaryView />);

    // 100 total tasks / 2 users = 50 avg
    expect(screen.getByText('50')).toBeInTheDocument();
  });

  it('should render refresh button', () => {
    render(<SummaryView />);

    const refreshButton = screen.getByRole('button', { name: /refresh/i });
    expect(refreshButton).toBeInTheDocument();
  });

  it('should call refetch when refresh button is clicked', async () => {
    const mockRefetch = vi.fn();
    vi.mocked(useStatistics.useSummaryStatistics).mockReturnValue({
      data: mockStatistics,
      isLoading: false,
      isError: false,
      refetch: mockRefetch,
    } as any);

    render(<SummaryView />);

    const refreshButton = screen.getByRole('button', { name: /refresh/i });
    refreshButton.click();

    await waitFor(() => {
      expect(mockRefetch).toHaveBeenCalled();
    });
  });

  it('should handle empty sprint data gracefully', () => {
    const emptyStats = {
      ...mockStatistics,
      tasksBySprint: [],
    };

    vi.mocked(useStatistics.useSummaryStatistics).mockReturnValue({
      data: emptyStats,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    } as any);

    render(<SummaryView />);

    expect(screen.getByText('0')).toBeInTheDocument(); // Active Sprints count
  });
});
