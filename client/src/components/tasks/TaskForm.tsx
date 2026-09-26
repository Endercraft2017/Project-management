/**
 * Task Form Component
 * Create and edit tasks with validation
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { X, ChevronDown } from 'lucide-react';
import { useSprints } from '@/hooks/useSprints';
import { useUsers } from '@/hooks/useUsers';
import { useTasks, useCreateTask, useUpdateTask, useCreateSubtask } from '@/hooks/useTasks';
import { formatDateInput } from '@/lib/utils';
import type { Task, CreateTaskInput, UpdateTaskInput } from '@/types';

interface TaskFormProps {
  task?: Task;
  parentTask?: Task;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function TaskForm({
  task,
  parentTask,
  onClose,
  onSuccess,
}: TaskFormProps) {
  const isEdit = !!task;
  const isSubtask = !!parentTask;

  const { data: sprintsData } = useSprints();
  const { data: usersData } = useUsers();
  const { data: tasksData } = useTasks(); // Get all tasks for parent selection

  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const createSubtask = useCreateSubtask();

  const sprints = Array.isArray(sprintsData?.data) ? sprintsData.data : [];
  const users = Array.isArray(usersData?.data?.users) ? usersData.data.users : [];
  const allTasks = Array.isArray(tasksData?.data) ? tasksData.data : [];

  const [formData, setFormData] = useState<
    CreateTaskInput | UpdateTaskInput
  >({
    taskName: task?.taskName || '',
    sprintId: task?.sprintId || parentTask?.sprintId || sprints[0]?.id || '',
    details: task?.details || '',
    assignedToId: task?.assignedToId || '',
    startDate: task?.startDate
      ? formatDateInput(task.startDate)
      : formatDateInput(new Date()),
    deadline: task?.deadline
      ? formatDateInput(task.deadline)
      : formatDateInput(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
    ...(isEdit && { progress: task.progress }),
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sprintInput, setSprintInput] = useState<string>('');
  const [isCreatingNewSprint, setIsCreatingNewSprint] = useState(false);
  const [parentTaskSearch, setParentTaskSearch] = useState<string>('');
  const [showParentDropdown, setShowParentDropdown] = useState(false);
  const parentDropdownRef = useRef<HTMLDivElement>(null);

  // Filter and group tasks for parent selection
  const groupedParentTasks = useMemo(() => {
    // Filter tasks
    const filtered = allTasks
      .filter(t => t.id !== task?.id && t.nestingLevel < 3) // Can't nest self or beyond level 3
      .filter(t => {
        if (!parentTaskSearch.trim()) return true;
        return t.taskName.toLowerCase().includes(parentTaskSearch.toLowerCase());
      });

    // Group by nesting level
    const groups = new Map<number, Task[]>();
    filtered.forEach(t => {
      if (!groups.has(t.nestingLevel)) {
        groups.set(t.nestingLevel, []);
      }
      groups.get(t.nestingLevel)!.push(t);
    });

    // Sort within each group by name
    groups.forEach((tasks, level) => {
      tasks.sort((a, b) => a.taskName.localeCompare(b.taskName));
    });

    // Convert to array and sort by level
    return Array.from(groups.entries())
      .sort(([levelA], [levelB]) => levelA - levelB)
      .map(([level, tasks]) => ({ level, tasks }));
  }, [allTasks, task?.id, parentTaskSearch]);

  // Get selected parent task name for display
  const selectedParentTask = useMemo(() => {
    const parentId = (formData as any).parentTaskId;
    if (!parentId) return '';
    return allTasks.find(t => t.id === parentId)?.taskName || '';
  }, [(formData as any).parentTaskId, allTasks]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (parentDropdownRef.current && !parentDropdownRef.current.contains(event.target as Node)) {
        setShowParentDropdown(false);
      }
    };

    if (showParentDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showParentDropdown]);

  // Initialize sprint input from existing sprint or allow new entry
  useEffect(() => {
    if (task?.sprintId) {
      const sprint = sprints.find(s => s.id === task.sprintId);
      setSprintInput(sprint?.name || '');
    } else if (parentTask?.sprintId) {
      const sprint = sprints.find(s => s.id === parentTask.sprintId);
      setSprintInput(sprint?.name || '');
    }
  }, [task, parentTask, sprints]);

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.taskName?.trim()) {
      newErrors.taskName = 'Task name is required';
    }

    if (!isEdit && !formData.sprintId && !sprintInput.trim()) {
      newErrors.sprintId = 'Sprint is required';
    }

    if (!formData.startDate) {
      newErrors.startDate = 'Start date is required';
    }

    if (!formData.deadline) {
      newErrors.deadline = 'Deadline is required';
    }

    if (formData.startDate && formData.deadline) {
      if (new Date(formData.startDate) > new Date(formData.deadline)) {
        newErrors.deadline = 'Deadline must be after start date';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    try {
      // Prepare data with sprintName if creating new sprint
      const submitData: any = { ...formData };
      if (isCreatingNewSprint && sprintInput.trim()) {
        submitData.sprintName = sprintInput.trim();
        delete submitData.sprintId; // Remove sprintId when using sprintName
      }

      if (isEdit && task) {
        await updateTask.mutateAsync({
          taskId: task.id,
          data: submitData as UpdateTaskInput,
        });
      } else if (isSubtask && parentTask) {
        await createSubtask.mutateAsync({
          parentTaskId: parentTask.id,
          data: submitData as CreateTaskInput,
        });
      } else {
        await createTask.mutateAsync(submitData as CreateTaskInput);
      }

      onSuccess?.();
      onClose();
    } catch (error: any) {
      console.error('Form submission error:', error);

      // Provide helpful error message
      let errorMessage = 'Failed to save task';

      if (error?.response?.status === 404) {
        errorMessage = 'Task not found. The page will refresh to update the task list.';
        // Close form and let the cache invalidation refresh the data
        setTimeout(() => {
          onClose();
        }, 2000);
      } else if (error?.response?.data?.message) {
        errorMessage = error.response.data.message;
      }

      setErrors({
        submit: errorMessage,
      });
    }
  };

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear error for this field
    if (errors[name]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];
        return newErrors;
      });
    }
  };

  const isLoading =
    createTask.isPending || updateTask.isPending || createSubtask.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-lg border border-border bg-card p-6 shadow-lg">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-semibold">
            {isEdit
              ? 'Edit Task'
              : isSubtask
                ? `Create Subtask for "${parentTask.taskName}"`
                : 'Create Task'}
          </h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 hover:bg-accent"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Task Name */}
          <div>
            <label className="mb-1 block text-sm font-medium">
              Task Name *
            </label>
            <input
              type="text"
              name="taskName"
              value={formData.taskName || ''}
              onChange={handleChange}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Enter task name"
            />
            {errors.taskName && (
              <p className="mt-1 text-sm text-destructive">{errors.taskName}</p>
            )}
          </div>

          {/* Sprint - Editable in edit mode for migration */}
          {(
            <div>
              <label className="mb-1 block text-sm font-medium">
                Sprint * {isSubtask && '(inherited from parent)'}
              </label>
              <div className="space-y-2">
                {/* Dropdown to select existing sprint */}
                <select
                  value={formData.sprintId || ''}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '__new__') {
                      setIsCreatingNewSprint(true);
                      setFormData({ ...formData, sprintId: '' });
                      setSprintInput('');
                    } else {
                      setIsCreatingNewSprint(false);
                      setFormData({ ...formData, sprintId: value });
                      const sprint = sprints.find(s => s.id === value);
                      setSprintInput(sprint?.name || '');
                    }
                  }}
                  disabled={isSubtask}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                >
                  <option value="">Select Existing Sprint</option>
                  {sprints.map((sprint) => (
                    <option key={sprint.id} value={sprint.id}>
                      {sprint.name}
                    </option>
                  ))}
                  <option value="__new__">+ Create New Sprint</option>
                </select>

                {/* Text input for new sprint name */}
                {isCreatingNewSprint && (
                  <input
                    type="text"
                    value={sprintInput}
                    onChange={(e) => setSprintInput(e.target.value)}
                    placeholder="Enter new sprint name"
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                )}
              </div>
              {errors.sprintId && (
                <p className="mt-1 text-sm text-destructive">
                  {errors.sprintId}
                </p>
              )}
            </div>
          )}

          {/* Parent Task - Always show for visibility, but make read-only when parent is preset */}
          {(
            <div>
              <label className="mb-1 block text-sm font-medium">
                Parent Task (Optional - for nesting)
              </label>
              <div ref={parentDropdownRef} className="relative">
                {/* Search Input */}
                <div className="relative">
                  <input
                    type="text"
                    value={showParentDropdown ? parentTaskSearch : (isSubtask && parentTask ? parentTask.taskName : selectedParentTask || 'No Parent (Root Task)')}
                    onChange={(e) => {
                      setParentTaskSearch(e.target.value);
                      if (!showParentDropdown) setShowParentDropdown(true);
                    }}
                    onFocus={() => {
                      if (!isSubtask) {
                        setShowParentDropdown(true);
                        setParentTaskSearch('');
                      }
                    }}
                    placeholder={isSubtask ? "Parent task is set" : "Search tasks..."}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    disabled={isSubtask}
                    readOnly={isSubtask}
                  />
                  <ChevronDown className="absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                </div>

                {/* Dropdown - only show if not in subtask mode */}
                {!isSubtask && showParentDropdown && (
                  <div className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-input bg-background shadow-lg">
                    {/* No Parent Option */}
                    <button
                      type="button"
                      onClick={() => {
                        setFormData({ ...formData, parentTaskId: '' } as any);
                        setShowParentDropdown(false);
                        setParentTaskSearch('');
                      }}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-accent focus:bg-accent focus:outline-none"
                    >
                      No Parent (Root Task)
                    </button>

                    {/* Grouped Tasks */}
                    {groupedParentTasks.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-muted-foreground">
                        No tasks found
                      </div>
                    ) : (
                      groupedParentTasks.map(({ level, tasks }) => (
                        <div key={level}>
                          {/* Level Header */}
                          <div className="bg-muted px-3 py-1 text-xs font-semibold text-muted-foreground">
                            Level {level}
                          </div>
                          {/* Tasks in this level */}
                          {tasks.map((t) => (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => {
                                setFormData({ ...formData, parentTaskId: t.id } as any);
                                setShowParentDropdown(false);
                                setParentTaskSearch('');
                              }}
                              className="w-full px-3 py-2 text-left text-sm hover:bg-accent focus:bg-accent focus:outline-none"
                            >
                              <div className="flex items-center justify-between">
                                <span>{t.taskName}</span>
                                <span className="text-xs text-muted-foreground">
                                  {t.sprint?.name || 'No Sprint'}
                                </span>
                              </div>
                            </button>
                          ))}
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {isSubtask
                  ? `This task will be created as a subtask of "${parentTask?.taskName}"`
                  : isEdit
                    ? 'Move this task under another task to make it a subtask'
                    : 'Select a parent task to create this as a subtask, or leave as "No Parent" for a root-level task'}
              </p>
            </div>
          )}

          {/* Assigned To */}
          <div>
            <label className="mb-1 block text-sm font-medium">
              Assigned To
            </label>
            <select
              name="assignedToId"
              value={formData.assignedToId || ''}
              onChange={handleChange}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">Unassigned</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
            {errors.assignedToId && (
              <p className="mt-1 text-sm text-destructive">
                {errors.assignedToId}
              </p>
            )}
          </div>

          {/* Dates */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">
                Start Date *
              </label>
              <input
                type="date"
                name="startDate"
                value={formData.startDate || ''}
                onChange={handleChange}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {errors.startDate && (
                <p className="mt-1 text-sm text-destructive">
                  {errors.startDate}
                </p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Deadline *
              </label>
              <input
                type="date"
                name="deadline"
                value={formData.deadline || ''}
                onChange={handleChange}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              {errors.deadline && (
                <p className="mt-1 text-sm text-destructive">
                  {errors.deadline}
                </p>
              )}
            </div>
          </div>

          {/* Progress (only for edit) */}
          {isEdit && (
            <div>
              <label className="mb-1 block text-sm font-medium">
                Progress: {formData.progress}%
              </label>
              <input
                type="range"
                name="progress"
                min="0"
                max="100"
                value={formData.progress || 0}
                onChange={handleChange}
                className="w-full"
              />
            </div>
          )}

          {/* Details */}
          <div>
            <label className="mb-1 block text-sm font-medium">Details</label>
            <textarea
              name="details"
              value={formData.details || ''}
              onChange={handleChange}
              rows={4}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Enter task details (optional)"
            />
          </div>

          {/* Submit Error */}
          {errors.submit && (
            <p className="text-sm text-destructive">{errors.submit}</p>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-input bg-background px-4 py-2 text-sm hover:bg-accent"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              disabled={isLoading}
            >
              {isLoading ? 'Saving...' : isEdit ? 'Update' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
