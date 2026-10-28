import { apiErrorMessage } from '@/lib/api-error';
/**
 * Task Node Component (Recursive)
 * Displays a single task with expand/collapse for subtasks
 */

import { useState } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Plus,
  Edit,
  Trash2,
  Calendar,
  User,
} from 'lucide-react';
import { useCurrentUser } from '@/hooks/useUsers';
import { useDeleteTask, useUpdateTask, useDeleteTaskSubtasks } from '@/hooks/useTasks';
import {
  formatDate,
  daysUntilDeadline,
  getProgressColor,
  getDeadlineColor,
  cn,
} from '@/lib/utils';
import type { Task } from '@/types';

interface TaskNodeProps {
  task: Task;
  level: number;
  onEdit: (task: Task) => void;
  onCreateSubtask: (parentTask: Task) => void;
  onViewDetails?: (task: Task) => void;
}

export default function TaskNode({
  task,
  level,
  onEdit,
  onCreateSubtask,
  onViewDetails,
}: TaskNodeProps) {
  const [isExpanded, setIsExpanded] = useState(level < 2); // Auto-expand first 2 levels
  const [isUpdatingProgress, setIsUpdatingProgress] = useState(false);

  const { data: currentUser } = useCurrentUser();
  const deleteTask = useDeleteTask();
  const updateTask = useUpdateTask();
  const deleteSubtasks = useDeleteTaskSubtasks();

  const hasSubtasks = task.subtasks && task.subtasks.length > 0;
  const canEdit =
    currentUser?.role === 'ADMIN' ||
    currentUser?.id === task.assignedToId ||
    currentUser?.id === task.createdById;
  const canDelete = currentUser?.role === 'ADMIN';
  const canCreateSubtask = level < 3; // Max nesting level is 3

  const daysLeft = daysUntilDeadline(task.deadline);
  const isOverdue = daysLeft < 0;

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this task? All subtasks will also be deleted.')) {
      return;
    }

    try {
      await deleteTask.mutateAsync(task.id);
    } catch (error: unknown) {
      alert(apiErrorMessage(error) || 'Failed to delete task');
    }
  };

  const handleProgressChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const newProgress = parseInt(e.target.value);
    setIsUpdatingProgress(true);

    try {
      await updateTask.mutateAsync({
        taskId: task.id,
        data: { progress: newProgress },
      });
    } catch (error: unknown) {
      alert(apiErrorMessage(error) || 'Failed to update progress');
    } finally {
      setIsUpdatingProgress(false);
    }
  };

  // Indentation based on level
  const indentClass = `pl-${level * 4}`;

  return (
    <div className={cn('border-b border-border', level > 0 && 'border-l-2 border-l-muted')}>
      <div
        className={cn(
          'group flex items-center gap-2 p-3 hover:bg-accent',
          level > 0 && indentClass
        )}
      >
        {/* Expand/Collapse Button */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={cn(
            'flex h-6 w-6 items-center justify-center rounded hover:bg-muted',
            !hasSubtasks && 'invisible'
          )}
        >
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>

        {/* Task Info */}
        <div className="flex min-w-0 flex-1 items-center gap-4">
          {/* Task Name */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <button
                onClick={() => onViewDetails?.(task)}
                className="font-medium hover:text-primary hover:underline text-left"
              >
                {task.taskName}
              </button>
              {hasSubtasks && (
                <span className="text-xs text-muted-foreground">
                  ({task.subtasks!.length} subtask{task.subtasks!.length !== 1 ? 's' : ''})
                </span>
              )}
            </div>
            {task.details && (
              <p className="mt-1 truncate text-sm text-muted-foreground">
                {task.details}
              </p>
            )}
          </div>

          {/* Assignee */}
          <button
            onClick={() => onViewDetails?.(task)}
            className="hidden items-center gap-1 text-sm text-muted-foreground hover:text-primary hover:underline sm:flex"
            title="Click to edit assignee"
          >
            <User className="h-4 w-4" />
            <span>{task.assignedTo?.name || 'Unassigned'}</span>
          </button>

          {/* Deadline */}
          <div
            className={cn(
              'hidden items-center gap-1 text-sm sm:flex',
              task.deadline ? getDeadlineColor(task.deadline) : 'text-muted-foreground'
            )}
          >
            <Calendar className="h-4 w-4" />
            <span>
              {task.deadline ? (
                <>
                  {formatDate(task.deadline)}
                  {isOverdue ? ` (${Math.abs(daysLeft)}d overdue)` : ` (${daysLeft}d)`}
                </>
              ) : (
                '-'
              )}
            </span>
          </div>

          {/* Progress */}
          <div className="hidden w-32 items-center gap-2 sm:flex">
            <input
              type="range"
              min="0"
              max="100"
              value={task.progress}
              onChange={handleProgressChange}
              disabled={!canEdit || isUpdatingProgress}
              className="w-full disabled:opacity-50"
            />
            <span className="w-12 text-sm text-muted-foreground">
              {task.progress}%
            </span>
          </div>

          {/* Progress Bar */}
          <div className="hidden w-24 sm:block">
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  'h-full transition-all',
                  getProgressColor(task.progress)
                )}
                style={{ width: `${task.progress}%` }}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            {canCreateSubtask && (
              <button
                onClick={() => onCreateSubtask(task)}
                className="rounded p-1 hover:bg-muted"
                title="Add Subtask"
              >
                <Plus className="h-4 w-4" />
              </button>
            )}
            {canEdit && (
              <button
                onClick={() => onEdit(task)}
                className="rounded p-1 hover:bg-muted"
                title="Edit Task"
              >
                <Edit className="h-4 w-4" />
              </button>
            )}
            {currentUser?.role === 'ADMIN' && hasSubtasks && (
              <button
                onClick={() => {
                  if (confirm(`Delete all subtasks under "${task.taskName}"? This cannot be undone.`)) {
                    deleteSubtasks.mutate(task.id);
                  }
                }}
                className="rounded p-1 text-orange-600 hover:bg-muted"
                title="Delete All Subtasks"
                disabled={deleteSubtasks.isPending}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            {canDelete && (
              <button
                onClick={handleDelete}
                className="rounded p-1 text-destructive hover:bg-muted"
                title="Delete Task"
                disabled={deleteTask.isPending}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Subtasks (Recursive) */}
      {hasSubtasks && isExpanded && (
        <div>
          {task.subtasks!.map((subtask) => (
            <TaskNode
              key={subtask.id}
              task={subtask}
              level={level + 1}
              onEdit={onEdit}
              onCreateSubtask={onCreateSubtask}
              onViewDetails={onViewDetails}
            />
          ))}
        </div>
      )}
    </div>
  );
}
