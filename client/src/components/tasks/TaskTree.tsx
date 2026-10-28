/**
 * Task Tree Component
 * Main component for displaying hierarchical task list
 */

import { useState, useMemo } from 'react';
import { Plus, RefreshCw, Upload, ChevronRight, ChevronDown, Trash2 } from 'lucide-react';
import { useTasks, useDeleteAllTasks, useDeleteSprintTasks } from '@/hooks/useTasks';
import { useSprints } from '@/hooks/useSprints';
import { useCurrentUser } from '@/hooks/useUsers';
import TaskFilters from './TaskFilters';
import TaskNode from './TaskNode';
import TaskForm from './TaskForm';
import TaskImport from './TaskImport';
import TaskDetailDrawer from './TaskDetailDrawer';
import type { Task, TaskFilters as TaskFiltersType } from '@/types';

export default function TaskTree() {
  const [filters, setFilters] = useState<TaskFiltersType>({});
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [parentTask, setParentTask] = useState<Task | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [expandedSprints, setExpandedSprints] = useState<Set<string>>(new Set());
  const [viewTask, setViewTask] = useState<Task | null>(null);

  const { data: tasksData, isLoading: isLoadingTasks, isError: isTasksError, error: tasksError, refetch: refetchTasks } = useTasks(filters);
  const { data: sprintsData, isLoading: isLoadingSprints, isError: isSprintsError, error: sprintsError } = useSprints();
  const { data: currentUser } = useCurrentUser();
  const deleteAllTasks = useDeleteAllTasks();
  const deleteSprintTasks = useDeleteSprintTasks();

  const tasks = useMemo(() => Array.isArray(tasksData?.data) ? tasksData.data : [], [tasksData]);
  const sprints = useMemo(() => Array.isArray(sprintsData?.data) ? sprintsData.data : [], [sprintsData]);

  // Debug logging
  console.log('TaskTree Debug:', {
    tasksCount: tasks.length,
    sprintsCount: sprints.length,
    tasksData: tasksData,
    sprintsData: sprintsData,
    isTasksError,
    isSprintsError,
    tasksError,
    sprintsError,
    filters,
  });

  const isLoading = isLoadingTasks || isLoadingSprints;
  const isError = isTasksError || isSprintsError;
  const refetch = refetchTasks;

  const toggleSprint = (sprintId: string) => {
    setExpandedSprints(prev => {
      const next = new Set(prev);
      if (next.has(sprintId)) {
        next.delete(sprintId);
      } else {
        next.add(sprintId);
      }
      return next;
    });
  };

  /**
   * Group tasks by sprint and build hierarchical tree
   */
  const sprintGroups = useMemo(() => {
    const buildTree = (tasks: Task[]): Task[] => {
      const taskMap = new Map<string, Task>();
      const rootTasks: Task[] = [];

      // First pass: Create map of all tasks
      tasks.forEach((task) => {
        taskMap.set(task.id, { ...task, subtasks: [] });
      });

      // Second pass: Build hierarchy
      tasks.forEach((task) => {
        const taskWithSubtasks = taskMap.get(task.id)!;

        if (task.parentTaskId) {
          const parent = taskMap.get(task.parentTaskId);
          if (parent) {
            parent.subtasks = parent.subtasks || [];
            parent.subtasks.push(taskWithSubtasks);
          } else {
            // Parent not in filtered list, add as root
            rootTasks.push(taskWithSubtasks);
          }
        } else {
          rootTasks.push(taskWithSubtasks);
        }
      });

      return rootTasks;
    };

    // Group tasks by sprint
    const groups = sprints.map(sprint => {
      const sprintTasks = tasks.filter(task => task.sprintId === sprint.id);
      const taskTree = buildTree(sprintTasks);
      return {
        sprint,
        tasks: taskTree,
        taskCount: sprintTasks.length,
      };
    });

    return groups;
  }, [tasks, sprints]);

  /**
   * Filter sprint groups recursively based on search
   */
  const filteredSprintGroups = useMemo(() => {
    if (!filters.search) return sprintGroups;

    const searchLower = filters.search.toLowerCase();

    const filterTask = (task: Task): Task | null => {
      const matchesSearch =
        task.taskName.toLowerCase().includes(searchLower) ||
        task.details?.toLowerCase().includes(searchLower) ||
        task.assignedTo?.name.toLowerCase().includes(searchLower);

      const filteredSubtasks = task.subtasks
        ?.map(filterTask)
        .filter((t): t is Task => t !== null);

      // Include task if it matches OR has matching descendants
      if (matchesSearch || (filteredSubtasks && filteredSubtasks.length > 0)) {
        return {
          ...task,
          subtasks: filteredSubtasks,
        };
      }

      return null;
    };

    return sprintGroups
      .map(group => ({
        ...group,
        tasks: group.tasks.map(filterTask).filter((t): t is Task => t !== null),
      }))
      .filter(group => group.tasks.length > 0);
  }, [sprintGroups, filters.search]);

  const handleCreateTask = () => {
    setSelectedTask(null);
    setParentTask(null);
    setShowForm(true);
  };

  const handleEditTask = (task: Task) => {
    setSelectedTask(task);
    setParentTask(null);
    setShowForm(true);
  };

  const handleCreateSubtask = (task: Task) => {
    setSelectedTask(null);
    setParentTask(task);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setSelectedTask(null);
    setParentTask(null);
  };

  const handleFormSuccess = () => {
    refetch();
  };

  const canCreateTask =
    currentUser?.role === 'ADMIN' || currentUser?.role === 'MEMBER';

  const isAdmin = currentUser?.role === 'ADMIN';

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Tasks</h1>
          <p className="text-muted-foreground">
            Manage your tasks and subtasks
          </p>
        </div>
        <div className="flex gap-2">
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
          {isAdmin && (
            <>
              <button
                onClick={() => setShowImport(true)}
                className="flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm hover:bg-accent"
              >
                <Upload className="h-4 w-4" />
                Import CSV
              </button>
              <button
                onClick={() => {
                  if (confirm('Are you sure you want to delete ALL tasks? This cannot be undone.')) {
                    deleteAllTasks.mutate();
                  }
                }}
                className="flex items-center gap-2 rounded-md border border-destructive bg-background px-4 py-2 text-sm text-destructive hover:bg-destructive hover:text-destructive-foreground"
                disabled={deleteAllTasks.isPending}
              >
                <Trash2 className="h-4 w-4" />
                Delete All
              </button>
            </>
          )}
          {canCreateTask && (
            <button
              onClick={handleCreateTask}
              className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
              New Task
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6">
        <TaskFilters filters={filters} onFiltersChange={setFilters} />
      </div>

      {/* Task List */}
      <div className="flex-1 overflow-auto rounded-md border border-border bg-card">
        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : isError ? (
          <div className="flex h-64 items-center justify-center">
            <p className="text-destructive">
              Failed to load tasks. Please try again.
            </p>
          </div>
        ) : filteredSprintGroups.length === 0 ? (
          <div className="flex h-64 flex-col items-center justify-center gap-4">
            <p className="text-muted-foreground">
              {filters.search || Object.keys(filters).length > 1
                ? 'No tasks match your filters'
                : 'No tasks yet'}
            </p>
            {canCreateTask && !filters.search && (
              <button
                onClick={handleCreateTask}
                className="flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90"
              >
                <Plus className="h-4 w-4" />
                Create your first task
              </button>
            )}
          </div>
        ) : (
          <div>
            {/* Table Header */}
            <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-muted/50 p-3 text-sm font-medium">
              <div className="w-6" /> {/* Expand button space */}
              <div className="min-w-0 flex-1">Task Name</div>
              <div className="hidden w-32 sm:block">Assignee</div>
              <div className="hidden w-40 sm:block">Deadline</div>
              <div className="hidden w-32 sm:block">Progress</div>
              <div className="hidden w-24 sm:block">Status</div>
              <div className="w-20">Actions</div>
            </div>

            {/* Sprint Groups */}
            {filteredSprintGroups.map((group) => (
              <div key={group.sprint.id}>
                {/* Sprint Header */}
                <div className="flex w-full items-center gap-2 border-b border-border bg-muted/30 p-3">
                  <button
                    onClick={() => toggleSprint(group.sprint.id)}
                    className="flex flex-1 items-center gap-2 text-left font-medium hover:opacity-80 transition-opacity"
                  >
                    {expandedSprints.has(group.sprint.id) ? (
                      <ChevronDown className="h-5 w-5 flex-shrink-0" />
                    ) : (
                      <ChevronRight className="h-5 w-5 flex-shrink-0" />
                    )}
                    <span className="font-semibold">{group.sprint.name}</span>
                    <span className="text-sm text-muted-foreground">
                      ({group.taskCount} {group.taskCount === 1 ? 'task' : 'tasks'})
                    </span>
                    <span className="ml-auto text-sm text-muted-foreground">
                      {new Date(group.sprint.startDate).toLocaleDateString()} - {new Date(group.sprint.endDate).toLocaleDateString()}
                    </span>
                  </button>
                  {isAdmin && group.taskCount > 0 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Delete all ${group.taskCount} tasks in "${group.sprint.name}"? This cannot be undone.`)) {
                          deleteSprintTasks.mutate(group.sprint.id);
                        }
                      }}
                      className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-destructive hover:bg-destructive hover:text-destructive-foreground transition-colors"
                      disabled={deleteSprintTasks.isPending}
                    >
                      <Trash2 className="h-3 w-3" />
                      Delete All
                    </button>
                  )}
                </div>

                {/* Tasks in Sprint */}
                {expandedSprints.has(group.sprint.id) && (
                  <div className="bg-card">
                    {group.tasks.map((task) => (
                      <TaskNode
                        key={task.id}
                        task={task}
                        level={0}
                        onEdit={handleEditTask}
                        onCreateSubtask={handleCreateSubtask}
                        onViewDetails={setViewTask}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Task Detail Drawer */}
      {viewTask && (
        <TaskDetailDrawer
          task={viewTask}
          onClose={() => setViewTask(null)}
          onEdit={(task) => {
            setViewTask(null);
            handleEditTask(task);
          }}
        />
      )}

      {/* Task Form Modal */}
      {showForm && (
        <TaskForm
          task={selectedTask || undefined}
          parentTask={parentTask || undefined}
          onClose={handleCloseForm}
          onSuccess={handleFormSuccess}
        />
      )}

      {/* Import Modal */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-lg bg-background p-6 shadow-lg">
            <TaskImport
              onSuccess={() => {
                refetch();
              }}
              onClose={() => setShowImport(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
