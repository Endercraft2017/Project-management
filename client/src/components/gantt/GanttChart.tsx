/**
 * Gantt Chart Component
 * Wrapper for Frappe Gantt library
 */

import { useEffect, useRef } from 'react';
import Gantt from 'frappe-gantt';
import type { Task } from '@/types';
import { escapeHtml } from '@/lib/utils';
import '@/styles/gantt.css';

interface GanttTask {
  id: string;
  name: string;
  start: string;
  end: string;
  progress: number;
  dependencies?: string;
  custom_class?: string;
}

interface GanttChartProps {
  tasks: Task[];
  viewMode: 'Quarter Day' | 'Half Day' | 'Day' | 'Week' | 'Month' | 'Year';
  onTaskChange?: (task: GanttTask, action: 'progress' | 'date') => void;
  onTaskClick?: (task: Task) => void;
  readOnly?: boolean;
}

export default function GanttChart({
  tasks,
  viewMode,
  onTaskChange,
  onTaskClick,
  readOnly = false,
}: GanttChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const ganttRef = useRef<Gantt | null>(null);

  // Transform tasks to Gantt format with validation
  const ganttTasks: GanttTask[] = (Array.isArray(tasks) ? tasks : [])
    .filter((task) => {
      // Validate task has required dates
      if (!task.startDate || !task.deadline) {
        console.warn(`Task ${task.id} missing dates, skipping`);
        return false;
      }

      // Validate dates are valid
      const start = new Date(task.startDate);
      const end = new Date(task.deadline);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        console.warn(`Task ${task.id} has invalid dates, skipping`);
        return false;
      }

      // Validate start is before end
      if (start >= end) {
        console.warn(`Task ${task.id} has start date after end date, skipping`);
        return false;
      }

      return true;
    })
    .map((task) => ({
      id: task.id,
      // frappe-gantt renders names with innerHTML (bar label and popup title)
      name: escapeHtml(task.taskName),
      start: task.startDate,
      end: task.deadline,
      progress: Math.max(0, Math.min(100, task.progress || 0)),
      custom_class: getTaskClass(task),
    }));

  useEffect(() => {
    if (!containerRef.current || ganttTasks.length === 0) {
      if (ganttRef.current) {
        containerRef.current!.innerHTML = '';
        ganttRef.current = null;
      }
      return;
    }

    try {
      // Clear previous instance
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }

      ganttRef.current = new Gantt(containerRef.current, ganttTasks, {
        view_mode: viewMode,
        on_click: (task: GanttTask) => {
          const originalTask = tasks.find((t) => t.id === task.id);
          if (originalTask && onTaskClick) {
            onTaskClick(originalTask);
          }
        },
        on_date_change: (task: GanttTask, start: Date, end: Date) => {
          if (!readOnly && onTaskChange) {
            onTaskChange(
              {
                ...task,
                start: start.toISOString(),
                end: end.toISOString(),
              },
              'date'
            );
          }
        },
        on_progress_change: (task: GanttTask, progress: number) => {
          if (!readOnly && onTaskChange) {
            onTaskChange({ ...task, progress }, 'progress');
          }
        },
        bar_height: 30,
        bar_corner_radius: 3,
        arrow_curve: 5,
        padding: 18,
        popup_trigger: 'click',
        language: 'en',
        readonly: readOnly,
      });
    } catch (error) {
      console.error('Failed to initialize Gantt chart:', error);
    }

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
      ganttRef.current = null;
    };
  }, [ganttTasks, viewMode, readOnly]);

  // Update view mode when changed
  useEffect(() => {
    if (ganttRef.current) {
      try {
        ganttRef.current.change_view_mode(viewMode);
      } catch (error) {
        console.error('Failed to change view mode:', error);
      }
    }
  }, [viewMode]);

  if (!Array.isArray(tasks) || tasks.length === 0) {
    return (
      <div className="flex h-[400px] items-center justify-center rounded-lg border border-border bg-card">
        <div className="text-center">
          <p className="text-lg font-semibold mb-2">No Tasks Yet</p>
          <p className="text-sm text-muted-foreground">
            Create tasks with start and end dates to visualize them on the Gantt chart
          </p>
        </div>
      </div>
    );
  }

  if (ganttTasks.length === 0) {
    return (
      <div className="flex h-[400px] items-center justify-center rounded-lg border border-border bg-card">
        <div className="text-center">
          <p className="text-lg font-semibold mb-2 text-warning">Invalid Date Ranges</p>
          <p className="text-sm text-muted-foreground">
            All tasks have missing or invalid dates. Please update task dates to view the Gantt chart.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="gantt-wrapper rounded-lg border border-border bg-card p-4">
      <div ref={containerRef} className="gantt-container" />
    </div>
  );
}

/**
 * Get CSS class for task based on status
 */
function getTaskClass(task: Task): string {
  const now = new Date();
  const deadline = new Date(task.deadline);

  if (task.progress === 100) {
    return 'gantt-task-completed';
  }
  if (deadline < now && task.progress < 100) {
    return 'gantt-task-overdue';
  }
  if (task.progress > 0) {
    return 'gantt-task-in-progress';
  }
  return 'gantt-task-not-started';
}
