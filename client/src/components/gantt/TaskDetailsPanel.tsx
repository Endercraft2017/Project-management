/**
 * Task Details Panel Component
 * Side panel showing detailed task information
 */

import { X, Calendar, User, TrendingUp, FileText } from 'lucide-react';
import { formatDate, daysUntilDeadline, getProgressColor } from '@/lib/utils';
import type { Task } from '@/types';

interface TaskDetailsPanelProps {
  task: Task;
  onClose: () => void;
}

export default function TaskDetailsPanel({
  task,
  onClose,
}: TaskDetailsPanelProps) {
  const daysLeft = daysUntilDeadline(task.deadline);
  const isOverdue = daysLeft < 0;

  return (
    <div className="w-96 border-l border-border bg-card p-6">
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <h2 className="text-xl font-semibold">{task.taskName}</h2>
        <button
          onClick={onClose}
          className="rounded-md p-1 hover:bg-accent"
          aria-label="Close panel"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Task Details */}
      <div className="space-y-4">
        {/* Sprint */}
        <div>
          <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
            <FileText className="h-4 w-4" />
            <span>Sprint</span>
          </div>
          <p className="font-medium">{task.sprint?.name || 'No sprint'}</p>
        </div>

        {/* Assigned To */}
        <div>
          <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
            <User className="h-4 w-4" />
            <span>Assigned To</span>
          </div>
          <div className="flex items-center gap-2">
            {task.assignedTo?.picture && (
              <img
                src={task.assignedTo.picture}
                alt={task.assignedTo.name}
                className="h-6 w-6 rounded-full"
              />
            )}
            <p className="font-medium">{task.assignedTo?.name || 'Unassigned'}</p>
          </div>
        </div>

        {/* Dates */}
        <div>
          <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>Timeline</span>
          </div>
          <div className="space-y-1">
            <p className="text-sm">
              <span className="text-muted-foreground">Start:</span>{' '}
              {formatDate(task.startDate)}
            </p>
            <p className="text-sm">
              <span className="text-muted-foreground">Deadline:</span>{' '}
              {formatDate(task.deadline)}
              {isOverdue ? (
                <span className="ml-2 text-xs text-destructive">
                  ({Math.abs(daysLeft)}d overdue)
                </span>
              ) : (
                <span className="ml-2 text-xs text-muted-foreground">
                  ({daysLeft}d remaining)
                </span>
              )}
            </p>
          </div>
        </div>

        {/* Progress */}
        <div>
          <div className="mb-1 flex items-center gap-2 text-sm text-muted-foreground">
            <TrendingUp className="h-4 w-4" />
            <span>Progress</span>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold">{task.progress}%</span>
              <span className="text-sm text-muted-foreground">
                {task.progress === 100
                  ? 'Completed'
                  : task.progress > 0
                    ? 'In Progress'
                    : 'Not Started'}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={`h-full transition-all ${getProgressColor(task.progress)}`}
                style={{ width: `${task.progress}%` }}
              />
            </div>
          </div>
        </div>

        {/* Details */}
        {task.details && (
          <div>
            <div className="mb-1 text-sm text-muted-foreground">
              Description
            </div>
            <p className="text-sm">{task.details}</p>
          </div>
        )}

        {/* Nesting Level */}
        <div>
          <div className="mb-1 text-sm text-muted-foreground">
            Task Level
          </div>
          <p className="text-sm">
            {task.nestingLevel === 0
              ? 'Top Level'
              : `Level ${task.nestingLevel}`}
          </p>
        </div>

        {/* Subtasks Count */}
        {task._count && task._count.subtasks > 0 && (
          <div>
            <div className="mb-1 text-sm text-muted-foreground">
              Subtasks
            </div>
            <p className="text-sm">{task._count.subtasks} subtasks</p>
          </div>
        )}

        {/* Created By */}
        <div>
          <div className="mb-1 text-sm text-muted-foreground">
            Created By
          </div>
          <p className="text-sm">{task.createdBy?.name || 'Unknown'}</p>
          <p className="text-xs text-muted-foreground">
            {formatDate(task.createdAt)}
          </p>
        </div>
      </div>
    </div>
  );
}
