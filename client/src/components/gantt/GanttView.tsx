/**
 * Gantt View Component
 * Main Gantt chart view with timeline visualization
 */

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useTasks, useUpdateTask } from '@/hooks/useTasks';
import { useCurrentUser } from '@/hooks/useUsers';
import GanttChart from './GanttChart';
import GanttToolbar from './GanttToolbar';
import TaskDetailsPanel from './TaskDetailsPanel';
import type { Task } from '@/types';

type ViewMode = 'Quarter Day' | 'Half Day' | 'Day' | 'Week' | 'Month' | 'Year';

export default function GanttView() {
  const [viewMode, setViewMode] = useState<ViewMode>('Week');
  const [selectedSprint, setSelectedSprint] = useState<string>('');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const { data: currentUser } = useCurrentUser();
  const { data: tasksData, isLoading, isError, refetch } = useTasks({
    sprintId: selectedSprint || undefined,
    nestingLevel: 0, // Only top-level tasks for clarity
  });

  const updateTask = useUpdateTask();

  const tasks = Array.isArray(tasksData?.data) ? tasksData.data : [];

  const handleTaskChange = (
    task: { id: string; start?: string; end?: string; progress?: number },
    action: 'progress' | 'date'
  ) => {
    // Only admins can update via drag-and-drop
    if (currentUser?.role !== 'ADMIN') {
      alert('Only admins can reschedule tasks via drag-and-drop');
      return;
    }

    const updateData: any = {};

    if (action === 'date' && task.start && task.end) {
      updateData.startDate = task.start;
      updateData.deadline = task.end;
    }

    if (action === 'progress' && task.progress !== undefined) {
      updateData.progress = task.progress;
    }

    updateTask.mutate({
      taskId: task.id,
      data: updateData,
    });
  };

  const handleExport = () => {
    // Export Gantt chart as PNG
    const ganttSvg = document.querySelector('.gantt-container svg');
    if (!ganttSvg) return;

    // Create a canvas
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Get SVG data
    const svgData = new XMLSerializer().serializeToString(ganttSvg);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);

    // Create image
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      // Download
      canvas.toBlob((blob) => {
        if (blob) {
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = `gantt-chart-${new Date().toISOString().split('T')[0]}.png`;
          a.click();
        }
      });

      URL.revokeObjectURL(url);
    };
    img.src = url;
  };

  const isReadOnly = currentUser?.role !== 'ADMIN';

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <RefreshCw className="mx-auto h-12 w-12 animate-spin text-muted-foreground" />
          <p className="mt-4 text-muted-foreground">Loading Gantt chart...</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="mb-4 text-destructive">
            Failed to load tasks. Please try again.
          </p>
          <button
            onClick={() => refetch()}
            className="rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col md:flex-row">
      <div className="flex-1 space-y-4 sm:space-y-6 p-3 sm:p-6 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Gantt Chart</h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Timeline visualization of project tasks
            </p>
          </div>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm hover:bg-accent"
            disabled={isLoading}
          >
            <RefreshCw
              className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`}
            />
            Refresh
          </button>
        </div>

        {/* Toolbar */}
        <GanttToolbar
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          selectedSprint={selectedSprint}
          onSprintChange={setSelectedSprint}
          onExport={handleExport}
        />

        {/* Info Banner */}
        {isReadOnly && (
          <div className="rounded-md bg-blue-50 p-4 dark:bg-blue-900/20">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              ℹ️ Viewing in read-only mode. Only admins can reschedule tasks via drag-and-drop.
            </p>
          </div>
        )}

        {/* Gantt Chart - Mobile: Enable horizontal scroll */}
        <div className="flex-1 overflow-x-auto overflow-y-auto -mx-3 sm:mx-0 px-3 sm:px-0">
          <div className="min-w-[800px]">
            <GanttChart
              tasks={tasks}
              viewMode={viewMode}
              onTaskChange={handleTaskChange}
              onTaskClick={setSelectedTask}
              readOnly={isReadOnly}
            />
          </div>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded bg-green-500" />
            <span>Completed</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded bg-blue-500" />
            <span>In Progress</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded bg-red-500" />
            <span>Overdue</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded bg-gray-400" />
            <span>Not Started</span>
          </div>
        </div>
      </div>

      {/* Task Details Panel */}
      {selectedTask && (
        <TaskDetailsPanel
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
        />
      )}
    </div>
  );
}
