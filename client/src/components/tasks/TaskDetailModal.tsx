/**
 * Task Detail Modal Component
 * Shows task information in a modal dialog
 * Permission-based editing: Admins and assignees can edit, others view-only
 */

import { useState, useEffect } from 'react';
import { X, Calendar, User, BarChart, FileText, Loader2 } from 'lucide-react';
import { useTask, useUpdateTask } from '@/hooks/useTasks';
import { useUsers, useCurrentUser } from '@/hooks/useUsers';
import { formatDate, getProgressColor, getDeadlineColor, daysUntilDeadline } from '@/lib/utils';

interface TaskDetailModalProps {
  taskId: string;
  onClose: () => void;
  viewMode?: 'normal' | 'mention';
}

export default function TaskDetailModal({ taskId, onClose, viewMode = 'normal' }: TaskDetailModalProps) {
  const { data: task, isLoading } = useTask(taskId, viewMode);

  const [isEditingAssignee, setIsEditingAssignee] = useState(false);
  const [isEditingDeadline, setIsEditingDeadline] = useState(false);
  const [selectedAssigneeId, setSelectedAssigneeId] = useState('');
  const [selectedDeadline, setSelectedDeadline] = useState('');

  const updateTask = useUpdateTask();
  const { data: usersData } = useUsers();
  const { data: currentUser } = useCurrentUser();
  const users = Array.isArray(usersData?.data?.users) ? usersData.data.users : [];

  const isAdmin = currentUser?.role === 'ADMIN';
  const isCreator = currentUser?.id === task?.createdById;
  const isAssignee = currentUser?.id === task?.assignedToId;
  const canEditAssignee = isAdmin || isCreator; // Admins and creators can change task assignment
  const canEditDeadline = isAdmin || isCreator; // Admins and creators can edit deadline
  const canEditDetails = isAdmin || isCreator || isAssignee; // Admins, creators, and assignees can edit details/progress

  useEffect(() => {
    if (task) {
      setSelectedAssigneeId(task.assignedToId || '');
      setSelectedDeadline(
        task.deadline ? new Date(task.deadline).toISOString().split('T')[0] : ''
      );
    }
  }, [task]);

  const handleAssigneeChange = async (newAssigneeId: string) => {
    if (!task) return;
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
    if (!task) return;
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

  if (isLoading) {
    return (
      <>
        {/* Overlay */}
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm" onClick={onClose} />

        {/* Modal */}
        <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-card shadow-lg">
          <div className="flex h-96 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </div>
      </>
    );
  }

  if (!task) {
    return (
      <>
        {/* Overlay */}
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm" onClick={onClose} />

        {/* Modal */}
        <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-card shadow-lg p-6">
          <div className="text-center">
            <p className="text-destructive">Task not found or you don't have permission to view it.</p>
            <button
              onClick={onClose}
              className="mt-4 rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
            >
              Close
            </button>
          </div>
        </div>
      </>
    );
  }

  const daysLeft = daysUntilDeadline(task.deadline);
  const isOverdue = daysLeft < 0;

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-card shadow-lg">
        <div className="flex max-h-[90vh] flex-col">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border p-6">
            <h2 className="text-2xl font-semibold">Task Details</h2>
            <button onClick={onClose} className="rounded-md p-2 hover:bg-accent">
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
                {!canEditDetails && (
                  <>
                    <span>•</span>
                    <span className="text-orange-600">View Only</span>
                  </>
                )}
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-4">
              {/* Assignee */}
              <div className="rounded-lg border border-border p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                  <User className="h-4 w-4" />
                  <span>Assigned To</span>
                  {!canEditAssignee && <span className="text-xs">(Admin/Creator only)</span>}
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
                      'No deadline'
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Progress */}
            <div className="rounded-lg border border-border p-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                <BarChart className="h-4 w-4" />
                <span>Progress</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-3 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full transition-all ${getProgressColor(task.progress)}`}
                    style={{ width: `${task.progress}%` }}
                  />
                </div>
                <span className="font-medium">{task.progress}%</span>
              </div>
            </div>

            {/* Details */}
            {task.details && (
              <div className="rounded-lg border border-border p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                  <FileText className="h-4 w-4" />
                  <span>Details</span>
                </div>
                <p className="whitespace-pre-wrap text-sm">{task.details}</p>
              </div>
            )}

            {/* Metadata */}
            <div className="rounded-lg border border-border p-4 text-sm text-muted-foreground">
              <div>Created by: {task.createdBy?.name}</div>
              <div>Created: {formatDate(task.createdAt)}</div>
              {task.updatedAt && <div>Last updated: {formatDate(task.updatedAt)}</div>}
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-border p-4">
            <button
              onClick={onClose}
              className="w-full rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
