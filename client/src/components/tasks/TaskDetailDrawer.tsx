/**
 * Task Detail Drawer Component
 * Shows full task information in a sliding drawer
 */

import { useState } from 'react';
import { X, Calendar, User, BarChart, FileText, List } from 'lucide-react';
import { useUpdateTask } from '@/hooks/useTasks';
import { useUsers, useCurrentUser } from '@/hooks/useUsers';
import { formatDate, getProgressColor, getDeadlineColor, daysUntilDeadline } from '@/lib/utils';
import type { Task } from '@/types';

interface TaskDetailDrawerProps {
  task: Task;
  onClose: () => void;
  onEdit: (task: Task) => void;
}

export default function TaskDetailDrawer({ task, onClose, onEdit }: TaskDetailDrawerProps) {
  const [isEditingAssignee, setIsEditingAssignee] = useState(false);
  const [isEditingDeadline, setIsEditingDeadline] = useState(false);
  const [selectedAssigneeId, setSelectedAssigneeId] = useState(task.assignedToId || '');
  const [selectedDeadline, setSelectedDeadline] = useState(
    task.deadline ? new Date(task.deadline).toISOString().split('T')[0] : ''
  );

  const updateTask = useUpdateTask();
  const { data: usersData } = useUsers();
  const { data: currentUser } = useCurrentUser();
  const users = Array.isArray(usersData?.data?.users) ? usersData.data.users : [];
  const isAdmin = currentUser?.role === 'ADMIN';
  const isCreator = currentUser?.id === task.createdById;
  const canEditAssignee = isAdmin || isCreator; // Admins and creators can change task assignment
  const canEditDeadline = isAdmin || isCreator; // Admins and creators can edit deadline

  const daysLeft = daysUntilDeadline(task.deadline);
  const isOverdue = daysLeft < 0;

  const handleAssigneeChange = async (newAssigneeId: string) => {
    try {
      await updateTask.mutateAsync({
        taskId: task.id,
        data: { assignedToId: newAssigneeId || null },
      });
      setIsEditingAssignee(false);
    } catch (error) {
      console.error('Failed to update assignee:', error);
    }
  };

  const handleDeadlineChange = async (newDeadline: string) => {
    try {
      await updateTask.mutateAsync({
        taskId: task.id,
        data: { deadline: newDeadline || undefined },
      });
      setIsEditingDeadline(false);
    } catch (error) {
      console.error('Failed to update deadline:', error);
    }
  };

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 z-50 h-full w-full max-w-2xl border-l border-border bg-card shadow-lg">
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border p-6">
            <h2 className="text-2xl font-semibold">Task Details</h2>
            <button
              onClick={onClose}
              className="rounded-md p-2 hover:bg-accent"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Task Name */}
            <div>
              <h3 className="text-xl font-medium mb-2">{task.taskName}</h3>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Sprint: {task.sprint?.name || 'No Sprint'}</span>
                <span>•</span>
                <span>Level {task.nestingLevel}</span>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-4">
              {/* Assignee */}
              <div className="rounded-lg border border-border p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                  <User className="h-4 w-4" />
                  <span>Assigned To</span>
                  {!canEditAssignee && <span className="text-xs">(Admin only)</span>}
                </div>
                {isEditingAssignee && canEditAssignee ? (
                  <select
                    value={selectedAssigneeId}
                    onChange={(e) => {
                      setSelectedAssigneeId(e.target.value);
                      handleAssigneeChange(e.target.value);
                    }}
                    onBlur={() => setIsEditingAssignee(false)}
                    autoFocus
                    className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
                  >
                    <option value="">Unassigned</option>
                    {users.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <button
                    onClick={() => canEditAssignee && setIsEditingAssignee(true)}
                    className={`text-left font-medium ${canEditAssignee ? 'hover:text-primary cursor-pointer' : 'cursor-default'}`}
                    disabled={!canEditAssignee}
                  >
                    {task.assignedTo?.name || 'Unassigned'}
                  </button>
                )}
              </div>

              {/* Deadline */}
              <div className="rounded-lg border border-border p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                  <Calendar className="h-4 w-4" />
                  <span>Deadline</span>
                  {!canEditDeadline && <span className="text-xs">(Admin/Creator only)</span>}
                </div>
                {isEditingDeadline && canEditDeadline ? (
                  <input
                    type="date"
                    value={selectedDeadline}
                    onChange={(e) => setSelectedDeadline(e.target.value)}
                    onBlur={() => {
                      handleDeadlineChange(selectedDeadline);
                      setIsEditingDeadline(false);
                    }}
                    autoFocus
                    className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm"
                  />
                ) : (
                  <div
                    onClick={() => canEditDeadline && setIsEditingDeadline(true)}
                    className={`text-left font-medium ${canEditDeadline ? 'cursor-pointer hover:text-primary' : 'cursor-not-allowed opacity-70'} ${getDeadlineColor(task.deadline)}`}
                  >
                    {task.deadline ? (
                      <>
                        {formatDate(task.deadline)}
                        {isOverdue ? ` (${Math.abs(daysLeft)}d overdue)` : ` (${daysLeft}d left)`}
                      </>
                    ) : (
                      '-'
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Progress */}
            <div className="rounded-lg border border-border p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                <BarChart className="h-4 w-4" />
                <span>Progress</span>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-2xl font-bold">{task.progress}%</span>
                </div>
                <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full transition-all ${getProgressColor(task.progress)}`}
                    style={{ width: `${task.progress}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Details/Notes */}
            <div className="rounded-lg border border-border p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                <FileText className="h-4 w-4" />
                <span>Details</span>
              </div>
              {task.details ? (
                <p className="text-sm whitespace-pre-wrap">{task.details}</p>
              ) : (
                <p className="text-sm text-muted-foreground italic">No details provided</p>
              )}
            </div>

            {/* Subtasks */}
            {task.subtasks && task.subtasks.length > 0 && (
              <div className="rounded-lg border border-border p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                  <List className="h-4 w-4" />
                  <span>Subtasks ({task.subtasks.length})</span>
                </div>
                <div className="space-y-2">
                  {task.subtasks.map((subtask) => (
                    <div
                      key={subtask.id}
                      className="flex items-center justify-between rounded-md border border-border p-3"
                    >
                      <span className="text-sm font-medium">{subtask.taskName}</span>
                      <span className="text-xs text-muted-foreground">{subtask.progress}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Created:</span>
                <p className="font-medium">{formatDate(task.createdAt)}</p>
                <p className="text-xs text-muted-foreground">by {task.createdBy?.name}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Updated:</span>
                <p className="font-medium">{formatDate(task.updatedAt)}</p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-border p-6">
            <button
              onClick={() => onEdit(task)}
              className="w-full rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Edit Task
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
