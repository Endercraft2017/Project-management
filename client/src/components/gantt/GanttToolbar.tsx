/**
 * Gantt Toolbar Component
 * Controls for view mode, filters, and export
 */

import { useState } from 'react';
import { Download, Calendar, Trash2 } from 'lucide-react';
import { useSprints, useDeleteSprint } from '@/hooks/useSprints';

type ViewMode = 'Quarter Day' | 'Half Day' | 'Day' | 'Week' | 'Month' | 'Year';

interface GanttToolbarProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  selectedSprint?: string;
  onSprintChange: (sprintId: string) => void;
  onExport?: () => void;
}

export default function GanttToolbar({
  viewMode,
  onViewModeChange,
  selectedSprint,
  onSprintChange,
  onExport,
}: GanttToolbarProps) {
  const { data: sprintsData } = useSprints({ includeStats: true });
  const sprints = Array.isArray(sprintsData?.data) ? sprintsData.data : [];
  const deleteSprint = useDeleteSprint();
  const [deleteConfirmSprintId, setDeleteConfirmSprintId] = useState<string | null>(null);

  const handleDeleteSprint = async (sprintId: string) => {
    const sprint = sprints.find((s) => s.id === sprintId);
    if (!sprint) return;

    const taskCount = (sprint as any)._count?.tasks || 0;

    try {
      await deleteSprint.mutateAsync({
        sprintId,
        moveTasksToBacklog: false,
        deleteTasks: true,
      });
      setDeleteConfirmSprintId(null);
      if (selectedSprint === sprintId) {
        onSprintChange('');
      }
    } catch (error: any) {
      console.error('Failed to delete sprint:', error);
      alert(error?.response?.data?.message || 'Failed to delete sprint');
    }
  };

  const viewModes: { value: ViewMode; label: string }[] = [
    { value: 'Day', label: 'Day' },
    { value: 'Week', label: 'Week' },
    { value: 'Month', label: 'Month' },
    { value: 'Year', label: 'Year' },
  ];

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
      {/* View Mode Switcher */}
      <div className="flex items-center gap-2">
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">View:</span>
        <div className="flex gap-1 rounded-md border border-input bg-background p-1">
          {viewModes.map((mode) => (
            <button
              key={mode.value}
              onClick={() => onViewModeChange(mode.value)}
              className={`rounded px-3 py-1 text-sm transition-colors ${
                viewMode === mode.value
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-accent'
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sprint Filter with Delete Button */}
      <div className="flex items-center gap-2">
        <label htmlFor="sprint-filter" className="text-sm font-medium">
          Sprint:
        </label>
        <select
          id="sprint-filter"
          value={selectedSprint || ''}
          onChange={(e) => onSprintChange(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">All Sprints</option>
          {sprints.map((sprint) => (
            <option key={sprint.id} value={sprint.id}>
              {sprint.name}
            </option>
          ))}
        </select>
        {selectedSprint && (
          <button
            onClick={() => setDeleteConfirmSprintId(selectedSprint)}
            className="rounded-md border border-destructive bg-background p-2 text-destructive hover:bg-destructive hover:text-destructive-foreground transition-colors"
            title="Delete Sprint"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmSprintId && (() => {
        const sprint = sprints.find((s) => s.id === deleteConfirmSprintId);
        const taskCount = (sprint as any)?._count?.tasks || 0;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg">
              <h3 className="mb-4 text-lg font-semibold">Delete Sprint</h3>
              <p className="mb-2 text-sm text-muted-foreground">
                Are you sure you want to delete sprint <strong>{sprint?.name}</strong>?
              </p>
              <p className="mb-4 text-sm text-destructive font-medium">
                This will permanently delete <strong>{taskCount} task{taskCount !== 1 ? 's' : ''}</strong> and all their subtasks. This action cannot be undone.
              </p>
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setDeleteConfirmSprintId(null)}
                  className="rounded-md border border-input bg-background px-4 py-2 text-sm hover:bg-accent"
                  disabled={deleteSprint.isPending}
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteSprint(deleteConfirmSprintId)}
                  className="rounded-md bg-destructive px-4 py-2 text-sm text-destructive-foreground hover:bg-destructive/90"
                  disabled={deleteSprint.isPending}
                >
                  {deleteSprint.isPending ? 'Deleting...' : 'Delete Sprint'}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Export Button */}
      {onExport && (
        <button
          onClick={onExport}
          className="flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm hover:bg-accent"
        >
          <Download className="h-4 w-4" />
          Export
        </button>
      )}
    </div>
  );
}
