/**
 * Task Management Service
 * Business logic for hierarchical task operations
 */

import { PrismaClient, Prisma, Role } from '@prisma/client';
import prisma from '@/database/client';
import {
  ListTasksQuery,
  CreateTask,
  UpdateTask,
  MoveToSprint,
} from './validators';
import { getSocketServer } from '@/chat/socket-server';

export class TaskService {
  /**
   * List tasks with filtering, sorting, and pagination
   */
  async listTasks(query: ListTasksQuery, userId: string, isAdmin: boolean) {
    const {
      page,
      limit,
      sprintId,
      assignedToId,
      createdById,
      parentTaskId,
      nestingLevel,
      minProgress,
      maxProgress,
      includeSubtasks,
      sortBy,
      sortOrder,
    } = query;

    // Build where clause
    const where: Prisma.TaskWhereInput = {};

    // Authorization filter: non-admins see only assigned or created tasks
    if (!isAdmin) {
      where.OR = [{ assignedToId: userId }, { createdById: userId }];
    }

    // Apply filters
    if (sprintId !== undefined) {
      where.sprintId = sprintId;
    }

    if (assignedToId) {
      // Special handling for 'null' string to filter unassigned tasks
      where.assignedToId = assignedToId === 'null' ? null : assignedToId;
    }

    if (createdById) {
      where.createdById = createdById;
    }

    if (parentTaskId !== undefined) {
      where.parentTaskId = parentTaskId;
    }

    if (nestingLevel !== undefined) {
      where.nestingLevel = nestingLevel;
    }

    if (minProgress !== undefined || maxProgress !== undefined) {
      where.progress = {};
      if (minProgress !== undefined) {
        where.progress.gte = minProgress;
      }
      if (maxProgress !== undefined) {
        where.progress.lte = maxProgress;
      }
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Build orderBy
    const orderBy: Prisma.TaskOrderByWithRelationInput = {
      [sortBy]: sortOrder,
    };

    // Execute queries in parallel
    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          assignedTo: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              name: true,
            },
          },
          sprint: {
            select: {
              id: true,
              name: true,
            },
          },
          _count: {
            select: {
              subtasks: true,
            },
          },
          ...(includeSubtasks && {
            subtasks: {
              include: {
                subtasks: {
                  include: {
                    subtasks: {
                      include: {
                        subtasks: true,
                      },
                    },
                  },
                },
              },
            },
          }),
        },
      }),
      prisma.task.count({ where }),
    ]);

    return {
      tasks,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get task by ID with relations
   */
  async getTaskById(
    id: string,
    includeSubtasks: boolean,
    includeParent: boolean
  ) {
    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
        sprint: {
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            subtasks: true,
          },
        },
        ...(includeParent && {
          parentTask: {
            select: {
              id: true,
              taskName: true,
              nestingLevel: true,
            },
          },
        }),
        ...(includeSubtasks && {
          subtasks: {
            include: {
              subtasks: {
                include: {
                  subtasks: {
                    include: {
                      subtasks: true,
                    },
                  },
                },
              },
            },
          },
        }),
      },
    });

    return task;
  }

  /**
   * Create a task (can be top-level or nested if parentTaskId is provided)
   */
  async createTask(data: CreateTask, userId: string, isAdmin: boolean) {
    // Verify assignment permissions
    if (data.assignedToId && data.assignedToId !== userId && !isAdmin) {
      throw new Error('Only admins can assign tasks to other users');
    }

    let sprintId = data.sprintId;
    let nestingLevel = 0;
    let parentTask: any = null;

    // If parentTaskId is provided, validate and get parent task details
    if (data.parentTaskId) {
      parentTask = await prisma.task.findUnique({
        where: { id: data.parentTaskId },
      });

      if (!parentTask) {
        throw new Error('Parent task not found');
      }

      // Verify permission on parent task
      if (!this.verifyTaskPermission(parentTask, userId, isAdmin)) {
        throw new Error('No permission to create task under this parent');
      }

      // Verify nesting depth limit (max level is 3)
      if (parentTask.nestingLevel >= 3) {
        throw new Error(
          'Maximum nesting depth (4 levels) reached. Cannot create task under this parent.'
        );
      }

      // Inherit sprint from parent if not explicitly provided
      if (!sprintId) {
        sprintId = parentTask.sprintId;
      }

      // Calculate nesting level
      nestingLevel = parentTask.nestingLevel + 1;
    }

    // Create new sprint if sprintName is provided instead of sprintId
    if (!sprintId && data.sprintName) {
      // Check if sprint with this name already exists
      let sprint = await prisma.sprint.findFirst({
        where: { name: data.sprintName },
      });

      if (!sprint) {
        // Create new sprint with default dates (2 weeks from now)
        const now = new Date();
        const twoWeeksLater = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

        sprint = await prisma.sprint.create({
          data: {
            name: data.sprintName,
            startDate: now,
            endDate: twoWeeksLater,
            status: 'ACTIVE',
            createdById: userId,
          },
        });
      }

      sprintId = sprint.id;
    }

    // Verify sprint exists if provided
    if (sprintId) {
      const sprint = await prisma.sprint.findUnique({
        where: { id: sprintId },
      });
      if (!sprint) {
        throw new Error('Sprint not found');
      }
    }

    // Verify assigned user exists if provided
    if (data.assignedToId) {
      const user = await prisma.user.findUnique({
        where: { id: data.assignedToId },
      });
      if (!user) {
        throw new Error('Assigned user not found');
      }
    }

    // Create task
    const task = await prisma.task.create({
      data: {
        taskName: data.taskName,
        details: data.details,
        startDate: data.startDate,
        deadline: data.deadline,
        sprintId: sprintId,
        assignedToId: data.assignedToId,
        createdById: userId,
        parentTaskId: data.parentTaskId || null,
        nestingLevel: nestingLevel,
        progress: 0, // Start at 0%
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Emit WebSocket event
    try {
      const io = getSocketServer();
      io.emit('task_created', task);

      // If task was assigned to someone, emit notification
      if (task.assignedToId) {
        io.emit('task_assigned', {
          task,
          assignedTo: task.assignedTo,
        });
        console.log(`[Task] New task ${task.id} assigned to ${task.assignedTo?.name}`);
      }

      // Notify admins when a non-admin creates a task
      if (!isAdmin) {
        // Fetch all admin users
        const admins = await prisma.user.findMany({
          where: { role: 'ADMIN', isActive: true },
          select: { id: true, name: true },
        });

        // Emit notification to each admin
        admins.forEach((admin) => {
          io.emit('task_created_by_member', {
            task,
            creator: task.createdBy,
            adminId: admin.id,
          });
        });
        console.log(`[Task] Notified ${admins.length} admins about task creation by ${task.createdBy?.name}`);
      }
    } catch (error) {
      console.error('[Task] Failed to emit WebSocket event:', error);
    }

    return task;
  }

  /**
   * Create a subtask under a parent task
   */
  async createSubtask(
    parentId: string,
    data: CreateTask,
    userId: string,
    isAdmin: boolean
  ) {
    // Find parent task
    const parent = await prisma.task.findUnique({
      where: { id: parentId },
      include: {
        _count: {
          select: {
            subtasks: true,
          },
        },
      },
    });

    if (!parent) {
      throw new Error('Parent task not found');
    }

    // Verify permission on parent task
    if (!this.verifyTaskPermission(parent, userId, isAdmin)) {
      throw new Error('No permission to create subtask under this task');
    }

    // Verify nesting depth limit (max level is 3, which is index 3, so parent must be < 3)
    if (parent.nestingLevel >= 3) {
      throw new Error(
        'Maximum nesting depth (4 levels) reached. Cannot create subtask.'
      );
    }

    // Verify assignment permissions
    if (data.assignedToId && data.assignedToId !== userId && !isAdmin) {
      throw new Error('Only admins can assign tasks to other users');
    }

    // Verify assigned user exists if provided
    if (data.assignedToId) {
      const user = await prisma.user.findUnique({
        where: { id: data.assignedToId },
      });
      if (!user) {
        throw new Error('Assigned user not found');
      }
    }

    // Create subtask (inherit sprint from parent, override is not allowed)
    const subtask = await prisma.task.create({
      data: {
        taskName: data.taskName,
        details: data.details,
        startDate: data.startDate,
        deadline: data.deadline,
        sprintId: parent.sprintId, // Inherit from parent
        assignedToId: data.assignedToId,
        createdById: userId,
        parentTaskId: parentId,
        nestingLevel: parent.nestingLevel + 1,
        progress: 0,
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
        parentTask: {
          select: {
            id: true,
            taskName: true,
            nestingLevel: true,
          },
        },
      },
    });

    // Emit WebSocket event
    try {
      const io = getSocketServer();
      io.emit('task_created', subtask);

      // If subtask was assigned to someone, emit notification
      if (subtask.assignedToId) {
        io.emit('task_assigned', {
          task: subtask,
          assignedTo: subtask.assignedTo,
        });
        console.log(`[Task] New subtask ${subtask.id} assigned to ${subtask.assignedTo?.name}`);
      }

      // Notify admins when a non-admin creates a subtask
      if (!isAdmin) {
        // Fetch all admin users
        const admins = await prisma.user.findMany({
          where: { role: 'ADMIN', isActive: true },
          select: { id: true, name: true },
        });

        // Emit notification to each admin
        admins.forEach((admin) => {
          io.emit('task_created_by_member', {
            task: subtask,
            creator: subtask.createdBy,
            adminId: admin.id,
          });
        });
        console.log(`[Task] Notified ${admins.length} admins about subtask creation by ${subtask.createdBy?.name}`);
      }
    } catch (error) {
      console.error('[Task] Failed to emit WebSocket event:', error);
    }

    return subtask;
  }

  /**
   * Update an existing task
   */
  async updateTask(
    id: string,
    data: UpdateTask,
    userId: string,
    isAdmin: boolean
  ) {
    // Find task
    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            subtasks: true,
          },
        },
      },
    });

    if (!task) {
      throw new Error('Task not found');
    }

    // Verify permission
    if (!this.verifyTaskPermission(task, userId, isAdmin)) {
      throw new Error('No permission to update this task');
    }

    // Verify assignment permissions
    if (data.assignedToId && data.assignedToId !== userId && !isAdmin) {
      throw new Error('Only admins can reassign tasks to other users');
    }

    // Verify sprint change rules
    if (data.sprintId !== undefined && task._count.subtasks > 0) {
      throw new Error(
        'Cannot change sprint of task with subtasks. Move subtasks first or use move-to-sprint endpoint.'
      );
    }

    // Verify sprint exists if provided
    if (data.sprintId) {
      const sprint = await prisma.sprint.findUnique({
        where: { id: data.sprintId },
      });
      if (!sprint) {
        throw new Error('Sprint not found');
      }
    }

    // Track if assignment changed for notification
    const assignmentChanged = data.assignedToId && data.assignedToId !== task.assignedToId;
    const previousAssigneeId = task.assignedToId;

    // Verify assigned user exists if provided
    if (data.assignedToId) {
      const user = await prisma.user.findUnique({
        where: { id: data.assignedToId },
      });
      if (!user) {
        throw new Error('Assigned user not found');
      }
    }

    // Verify parent task exists if provided and prevent circular references
    if (data.parentTaskId !== undefined) {
      if (data.parentTaskId) {
        const parentTask = await prisma.task.findUnique({
          where: { id: data.parentTaskId },
        });
        if (!parentTask) {
          throw new Error('Parent task not found');
        }
        // Prevent making a task its own parent or ancestor
        if (data.parentTaskId === id) {
          throw new Error('Task cannot be its own parent');
        }
      }
    }

    // Update task
    const updatedTask = await prisma.task.update({
      where: { id },
      data: {
        ...(data.taskName && { taskName: data.taskName }),
        ...(data.details !== undefined && { details: data.details }),
        ...(data.startDate && { startDate: data.startDate }),
        ...(data.deadline && { deadline: data.deadline }),
        ...(data.sprintId !== undefined && { sprintId: data.sprintId }),
        ...(data.assignedToId !== undefined && { assignedToId: data.assignedToId || null }),
        ...(data.parentTaskId !== undefined && {
          parentTaskId: data.parentTaskId || null
        }),
        ...(data.progress !== undefined && { progress: data.progress }),
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // If progress was updated, cascade to parent
    if (data.progress !== undefined && task.parentTaskId) {
      await this.recalculateParentProgress(task.parentTaskId);
    }

    // Emit WebSocket events
    try {
      const io = getSocketServer();

      // Emit general task update to all clients
      io.emit('task_updated', updatedTask);

      // If task was assigned to someone new, emit special notification
      if (assignmentChanged && data.assignedToId) {
        io.emit('task_assigned', {
          task: updatedTask,
          assignedTo: updatedTask.assignedTo,
        });
        console.log(`[Task] Task ${updatedTask.id} assigned to ${updatedTask.assignedTo?.name}`);
      }
    } catch (error) {
      console.error('[Task] Failed to emit WebSocket event:', error);
      // Don't throw - socket failure shouldn't break task update
    }

    return updatedTask;
  }

  /**
   * Move task and all subtasks to different sprint
   */
  async moveToSprint(
    id: string,
    sprintId: string | null,
    userId: string,
    isAdmin: boolean
  ) {
    if (!isAdmin) {
      throw new Error('Only admins can move tasks to different sprints');
    }

    // Find task
    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            subtasks: true,
          },
        },
      },
    });

    if (!task) {
      throw new Error('Task not found');
    }

    // Verify sprint exists if not null
    if (sprintId) {
      const sprint = await prisma.sprint.findUnique({
        where: { id: sprintId },
      });
      if (!sprint) {
        throw new Error('Sprint not found');
      }
    }

    // Get all descendant IDs
    const descendantIds = await this.getAllDescendantIds(id);

    // Update task and all descendants in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update all descendants
      if (descendantIds.length > 0) {
        await tx.task.updateMany({
          where: {
            id: {
              in: descendantIds,
            },
          },
          data: {
            sprintId,
          },
        });
      }

      // Update the task itself
      const updatedTask = await tx.task.update({
        where: { id },
        data: { sprintId },
      });

      return {
        task: updatedTask,
        subtasksUpdated: descendantIds.length,
      };
    });

    return result;
  }

  /**
   * Delete all tasks in the system
   */
  async deleteAllTasks(): Promise<number> {
    const result = await prisma.task.deleteMany({});
    return result.count;
  }

  /**
   * Delete all tasks in a specific sprint
   */
  async deleteSprintTasks(sprintId: string): Promise<number> {
    const result = await prisma.task.deleteMany({
      where: { sprintId },
    });
    return result.count;
  }

  /**
   * Delete all subtasks under a specific task (recursively)
   */
  async deleteTaskSubtasks(taskId: string): Promise<number> {
    // Verify task exists
    const task = await prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new Error('Task not found');
    }

    // Get all descendant IDs recursively
    const descendantIds = await this.getAllDescendantIds(taskId);

    // Delete all descendants
    if (descendantIds.length > 0) {
      const result = await prisma.task.deleteMany({
        where: {
          id: {
            in: descendantIds,
          },
        },
      });
      return result.count;
    }

    return 0;
  }

  /**
   * Delete task and optionally cascade to subtasks
   */
  async deleteTask(id: string, cascade: boolean, userId: string, isAdmin: boolean) {
    // Find task
    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            subtasks: true,
          },
        },
      },
    });

    if (!task) {
      throw new Error('Task not found');
    }

    // Verify permission - members can delete their own created tasks
    if (!this.verifyTaskPermission(task, userId, isAdmin)) {
      throw new Error('No permission to delete this task');
    }

    // Check for subtasks
    if (task._count.subtasks > 0 && !cascade) {
      throw new Error(
        `Task has ${task._count.subtasks} subtasks. Use cascade=true to delete all subtasks.`
      );
    }

    // Delete task (cascade is handled by database schema)
    await prisma.task.delete({
      where: { id },
    });

    // Emit WebSocket event
    try {
      const io = getSocketServer();
      io.emit('task_deleted', id);
      console.log(`[Task] Task ${id} deleted`);
    } catch (error) {
      console.error('[Task] Failed to emit WebSocket event:', error);
    }
  }

  /**
   * Get task hierarchy (ancestors and descendants)
   */
  async getTaskHierarchy(id: string, userId: string, isAdmin: boolean) {
    // Find task
    const task = await prisma.task.findUnique({
      where: { id },
    });

    if (!task) {
      throw new Error('Task not found');
    }

    // Verify permission
    if (!this.verifyTaskPermission(task, userId, isAdmin)) {
      throw new Error('No permission to view this task');
    }

    // Get ancestors (path to root)
    const ancestors = await this.getAncestors(id);

    // Get descendants (full subtree)
    const descendants = await this.getDescendantsTree(id);

    return {
      root: ancestors.length > 0 ? ancestors[0] : null,
      path: ancestors.slice(1),
      current: {
        id: task.id,
        taskName: task.taskName,
        nestingLevel: task.nestingLevel,
        progress: task.progress,
      },
      descendants,
    };
  }

  /**
   * Get task statistics
   */
  async getTaskStats(id: string, userId: string, isAdmin: boolean) {
    // Find task
    const task = await prisma.task.findUnique({
      where: { id },
    });

    if (!task) {
      throw new Error('Task not found');
    }

    // Verify permission
    if (!this.verifyTaskPermission(task, userId, isAdmin)) {
      throw new Error('No permission to view this task');
    }

    // Get all descendants
    const descendantIds = await this.getAllDescendantIds(id);

    // Get subtask statistics
    const subtasks = await prisma.task.findMany({
      where: {
        id: {
          in: descendantIds,
        },
      },
      select: {
        progress: true,
      },
    });

    const totalSubtasks = subtasks.length;
    const completedSubtasks = subtasks.filter((t) => t.progress === 100).length;
    const inProgressSubtasks = subtasks.filter(
      (t) => t.progress > 0 && t.progress < 100
    ).length;

    // Calculate overall progress
    const overallProgress =
      totalSubtasks > 0
        ? subtasks.reduce((sum, t) => sum + t.progress, 0) / totalSubtasks
        : task.progress;

    // Calculate estimated completion (simple linear projection)
    let estimatedCompletion = null;
    let daysRemaining = null;
    let isOnTrack = true;

    if (task.deadline) {
      const now = new Date();
      daysRemaining = Math.ceil(
        (task.deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      // If we have start date, calculate if on track
      if (task.startDate) {
        const totalDays = Math.ceil(
          (task.deadline.getTime() - task.startDate.getTime()) /
            (1000 * 60 * 60 * 24)
        );
        const elapsedDays = Math.ceil(
          (now.getTime() - task.startDate.getTime()) / (1000 * 60 * 60 * 24)
        );
        const expectedProgress = (elapsedDays / totalDays) * 100;

        isOnTrack = overallProgress >= expectedProgress;

        // Estimate completion based on current velocity
        if (overallProgress > 0) {
          const velocity = overallProgress / elapsedDays; // % per day
          const remainingProgress = 100 - overallProgress;
          const estimatedDays = Math.ceil(remainingProgress / velocity);
          estimatedCompletion = new Date(
            now.getTime() + estimatedDays * 24 * 60 * 60 * 1000
          );
        }
      }
    }

    return {
      totalSubtasks,
      completedSubtasks,
      inProgressSubtasks,
      overallProgress: Math.round(overallProgress * 10) / 10, // Round to 1 decimal
      estimatedCompletion,
      isOnTrack,
      daysRemaining,
    };
  }

  /**
   * Helper: Recalculate parent progress based on subtasks
   */
  private async recalculateParentProgress(parentId: string) {
    // Get all direct subtasks
    const subtasks = await prisma.task.findMany({
      where: { parentTaskId: parentId },
      select: {
        progress: true,
      },
    });

    if (subtasks.length === 0) {
      return;
    }

    // Calculate average progress
    const averageProgress =
      subtasks.reduce((sum, task) => sum + task.progress, 0) / subtasks.length;

    // Update parent progress
    const parent = await prisma.task.update({
      where: { id: parentId },
      data: {
        progress: Math.round(averageProgress),
      },
    });

    // Recurse up the hierarchy
    if (parent.parentTaskId) {
      await this.recalculateParentProgress(parent.parentTaskId);
    }
  }

  /**
   * Helper: Verify if user has permission to access task
   */
  private verifyTaskPermission(
    task: { assignedToId: string | null; createdById: string },
    userId: string,
    isAdmin: boolean
  ): boolean {
    if (isAdmin) return true;
    if (task.assignedToId === userId) return true;
    if (task.createdById === userId) return true;
    return false;
  }

  /**
   * Helper: Get all descendant IDs (flat list)
   */
  private async getAllDescendantIds(taskId: string): Promise<string[]> {
    const descendants: string[] = [];

    const getChildren = async (id: string) => {
      const children = await prisma.task.findMany({
        where: { parentTaskId: id },
        select: { id: true },
      });

      for (const child of children) {
        descendants.push(child.id);
        await getChildren(child.id); // Recurse
      }
    };

    await getChildren(taskId);
    return descendants;
  }

  /**
   * Helper: Get ancestors (path to root)
   */
  private async getAncestors(
    taskId: string
  ): Promise<Array<{ id: string; taskName: string; nestingLevel: number }>> {
    const ancestors: Array<{
      id: string;
      taskName: string;
      nestingLevel: number;
    }> = [];

    let currentId: string | null = taskId;

    while (currentId) {
      const task = await prisma.task.findUnique({
        where: { id: currentId },
        select: {
          id: true,
          taskName: true,
          nestingLevel: true,
          parentTaskId: true,
        },
      });

      if (!task) break;

      if (task.parentTaskId) {
        const parent = await prisma.task.findUnique({
          where: { id: task.parentTaskId },
          select: {
            id: true,
            taskName: true,
            nestingLevel: true,
          },
        });

        if (parent) {
          ancestors.unshift(parent); // Add to beginning
        }
      }

      currentId = task.parentTaskId;
    }

    return ancestors;
  }

  /**
   * Helper: Get descendants tree structure
   */
  private async getDescendantsTree(taskId: string): Promise<any[]> {
    const children = await prisma.task.findMany({
      where: { parentTaskId: taskId },
      select: {
        id: true,
        taskName: true,
        nestingLevel: true,
        progress: true,
      },
    });

    const tree = [];

    for (const child of children) {
      const subtree = await this.getDescendantsTree(child.id);
      tree.push({
        ...child,
        children: subtree,
      });
    }

    return tree;
  }
}

export const taskService = new TaskService();
