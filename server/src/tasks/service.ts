/**
 * Task Management Service
 * Business logic for hierarchical task operations
 */

import { Prisma } from "@prisma/client";
import prisma from "@/database/client";
import { ListTasksQuery, CreateTask, UpdateTask } from "./validators";
import { getSocketServer, emitTenantEvent } from "@/chat/socket-server";
import {
  withTaskTopology,
  taskAncestry,
  taskSubtree,
  setSubtreeDepth,
  recalculateProgress,
  hierarchyConflict,
  taskReadWhere,
  visibleSubtasks,
} from "./hierarchy";

const taskRelations = {
  assignedTo: { select: { id: true, name: true, email: true } },
  createdBy: { select: { id: true, name: true } },
} satisfies Prisma.TaskInclude;

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
    const where: Prisma.TaskWhereInput = taskReadWhere(userId, isAdmin);

    // Apply filters
    if (sprintId !== undefined) {
      where.sprintId = sprintId;
    }

    if (assignedToId) {
      // Special handling for 'null' string to filter unassigned tasks
      where.assignedToId = assignedToId === "null" ? null : assignedToId;
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

    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          ...taskRelations,
          sprint: { select: { id: true, name: true } },
          _count: {
            select: { subtasks: { where: taskReadWhere(userId, isAdmin) } },
          },
          ...(includeSubtasks && {
            subtasks: visibleSubtasks(userId, isAdmin),
          }),
        },
      }),
      prisma.task.count({ where }),
    ]);
    return {
      tasks,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async getTaskById(
    id: string,
    includeSubtasks: boolean,
    includeParent: boolean,
    userId: string,
    isAdmin: boolean,
  ) {
    const task = await prisma.task.findUnique({
      where: { id },
      include: {
        ...taskRelations,
        sprint: { select: { id: true, name: true } },
        _count: {
          select: { subtasks: { where: taskReadWhere(userId, isAdmin) } },
        },
        parentTask: {
          select: {
            id: true,
            taskName: true,
            nestingLevel: true,
            createdById: true,
            assignedToId: true,
          },
        },
        ...(includeSubtasks && { subtasks: visibleSubtasks(userId, isAdmin) }),
      },
    });
    if (!task) return null;
    if (!this.verifyTaskPermission(task, userId, isAdmin))
      throw Object.assign(new Error("No permission to access this task"), {
        status: 403,
      });
    const { parentTask, ...result } = task;
    return {
      ...result,
      ...(includeParent && {
        parentTask:
          parentTask && this.verifyTaskPermission(parentTask, userId, isAdmin)
            ? {
                id: parentTask.id,
                taskName: parentTask.taskName,
                nestingLevel: parentTask.nestingLevel,
              }
            : null,
      }),
    };
  }

  /** Create roots or children under the same serialized topology transaction. */
  async createTask(data: CreateTask, userId: string, isAdmin: boolean) {
    if (data.assignedToId && data.assignedToId !== userId && !isAdmin)
      throw Object.assign(
        new Error("Only admins can assign tasks to other users"),
        { status: 403 },
      );
    const result = await withTaskTopology(async (tx) => {
      const changed = new Set<string>();
      let sprintId = data.sprintId || null;
      let projectId: string | null = null;
      let nestingLevel = 0;
      if (data.parentTaskId) {
        const parent = await tx.task.findUnique({
          where: { id: data.parentTaskId },
        });
        if (!parent)
          throw Object.assign(new Error("Parent task not found"), {
            status: 404,
          });
        if (!this.verifyTaskPermission(parent, userId, isAdmin))
          throw Object.assign(
            new Error("No permission to create task under this parent"),
            { status: 403 },
          );
        nestingLevel = (await taskAncestry(tx, parent)).length;
        if (nestingLevel > 3)
          throw hierarchyConflict("Maximum nesting depth (4 levels) reached.");
        if (
          (data.sprintId && data.sprintId !== parent.sprintId) ||
          data.sprintName
        )
          throw hierarchyConflict(
            "A subtask must inherit its parent project and sprint.",
          );
        sprintId = parent.sprintId;
        projectId = parent.projectId;
      } else if (!sprintId && data.sprintName) {
        let sprint = await tx.sprint.findFirst({
          where: { name: data.sprintName },
        });
        if (!sprint) {
          const now = new Date();
          sprint = await tx.sprint.create({
            data: {
              name: data.sprintName,
              startDate: now,
              endDate: new Date(now.getTime() + 14 * 86400000),
              status: "ACTIVE",
              createdById: userId,
            },
          });
        }
        sprintId = sprint.id;
      }
      if (sprintId) {
        const sprint = await tx.sprint.findUnique({ where: { id: sprintId } });
        if (!sprint)
          throw Object.assign(new Error("Sprint not found"), { status: 404 });
        if (data.parentTaskId && sprint.projectId !== projectId)
          throw hierarchyConflict(
            "Task and sprint must belong to the same project.",
          );
        projectId = sprint.projectId;
      }
      await this.validateAssignee(tx, data.assignedToId);
      const task = await tx.task.create({
        data: {
          taskName: data.taskName,
          details: data.details,
          startDate: data.startDate,
          deadline: data.deadline,
          sprintId,
          projectId,
          assignedToId: data.assignedToId,
          createdById: userId,
          parentTaskId: data.parentTaskId || null,
          nestingLevel,
          progress: 0,
        },
        include: taskRelations,
      });
      await recalculateProgress(tx, task.parentTaskId, changed);
      return { task, updated: await this.changedTasks(tx, changed) };
    });
    this.emitUpdates(result.updated);
    try {
      const io = getSocketServer();
      io.emit("task_created", result.task);
      if (result.task.assignedToId)
        io.to(`user:${result.task.assignedToId}`).emit("task_assigned", {
          task: result.task,
          assignedTo: result.task.assignedTo,
        });
      if (!isAdmin) {
        const admins = await prisma.user.findMany({
          where: { role: "ADMIN", isActive: true },
          select: { id: true },
        });
        for (const admin of admins)
          io.to(`user:${admin.id}`).emit("task_created_by_member", {
            task: result.task,
            creator: result.task.createdBy,
            adminId: admin.id,
          });
      }
    } catch {
      console.error("[Task] Realtime delivery unavailable");
    }
    return result.task;
  }

  async createSubtask(
    parentId: string,
    data: CreateTask,
    userId: string,
    isAdmin: boolean,
  ) {
    if (data.parentTaskId && data.parentTaskId !== parentId)
      throw hierarchyConflict("Conflicting parent task IDs.");
    return this.createTask(
      { ...data, parentTaskId: parentId },
      userId,
      isAdmin,
    );
  }

  /** Reparent a complete subtree; validate links and levels before any write. */
  async updateTask(
    id: string,
    data: UpdateTask,
    userId: string,
    isAdmin: boolean,
  ) {
    const result = await withTaskTopology(async (tx) => {
      const task = await tx.task.findUnique({ where: { id } });
      if (!task)
        throw Object.assign(new Error("Task not found"), { status: 404 });
      if (!this.verifyTaskPermission(task, userId, isAdmin))
        throw Object.assign(new Error("No permission to update this task"), {
          status: 403,
        });
      if (data.assignedToId && data.assignedToId !== userId && !isAdmin)
        throw Object.assign(
          new Error("Only admins can reassign tasks to other users"),
          { status: 403 },
        );
      await taskAncestry(tx, task);
      const subtree = await taskSubtree(tx, task);
      const changed = new Set<string>([id]);
      const parentId =
        data.parentTaskId === undefined ? task.parentTaskId : data.parentTaskId;
      const sprintId =
        data.sprintId === undefined ? task.sprintId : data.sprintId;
      if (sprintId !== task.sprintId && subtree.length > 1)
        throw hierarchyConflict(
          "Cannot change sprint of a task with subtasks. Use move-to-sprint.",
        );
      if (sprintId) {
        const sprint = await tx.sprint.findUnique({ where: { id: sprintId } });
        if (!sprint)
          throw Object.assign(new Error("Sprint not found"), { status: 404 });
        if (sprint.projectId !== task.projectId)
          throw hierarchyConflict(
            "Task and sprint must belong to the same project.",
          );
      }
      let depth = 0;
      if (parentId) {
        if (subtree.some((entry) => entry.task.id === parentId))
          throw hierarchyConflict(
            "A task cannot be parented to itself or its descendants.",
          );
        const parent = await tx.task.findUnique({ where: { id: parentId } });
        if (!parent)
          throw Object.assign(new Error("Parent task not found"), {
            status: 404,
          });
        if (
          parentId !== task.parentTaskId &&
          !this.verifyTaskPermission(parent, userId, isAdmin)
        )
          throw Object.assign(
            new Error("No permission to use this parent task"),
            { status: 403 },
          );
        if (parent.sprintId !== sprintId || parent.projectId !== task.projectId)
          throw hierarchyConflict(
            "Parent and child tasks must belong to the same project and sprint.",
          );
        depth = (await taskAncestry(tx, parent)).length;
      }
      if (subtree.some((entry) => depth + entry.relativeDepth > 3))
        throw hierarchyConflict(
          "Maximum nesting depth (4 levels) reached for this subtree.",
        );
      if (data.progress !== undefined && subtree.length > 1)
        throw hierarchyConflict(
          "Parent progress is calculated from its subtasks.",
        );
      await this.validateAssignee(tx, data.assignedToId);
      await tx.task.update({
        where: { id },
        data: {
          ...(data.taskName !== undefined && { taskName: data.taskName }),
          ...(data.details !== undefined && { details: data.details }),
          ...(data.startDate !== undefined && { startDate: data.startDate }),
          ...(data.deadline !== undefined && { deadline: data.deadline }),
          sprintId,
          parentTaskId: parentId,
          ...(data.assignedToId !== undefined && {
            assignedToId: data.assignedToId || null,
          }),
          ...(data.progress !== undefined && { progress: data.progress }),
        },
      });
      await setSubtreeDepth(tx, subtree, depth, changed);
      await recalculateProgress(tx, task.parentTaskId, changed);
      if (parentId !== task.parentTaskId)
        await recalculateProgress(tx, parentId, changed);
      const updated = await this.changedTasks(tx, changed);
      return {
        task: updated.find((item) => item.id === id)!,
        updated,
        assignmentChanged:
          !!data.assignedToId && data.assignedToId !== task.assignedToId,
      };
    });
    this.emitUpdates(result.updated);
    if (result.assignmentChanged) {
      try {
        getSocketServer()
          .to(`user:${result.task.assignedToId}`)
          .emit("task_assigned", {
            task: result.task,
            assignedTo: result.task.assignedTo,
          });
      } catch {
        console.error("[Task] Realtime delivery unavailable");
      }
    }
    return result.task;
  }

  /** Moving a nested subtree to another sprint detaches it to a top-level task. */
  async moveToSprint(
    id: string,
    sprintId: string | null,
    userId: string,
    isAdmin: boolean,
  ) {
    if (!isAdmin)
      throw Object.assign(
        new Error("Only admins can move tasks to different sprints"),
        { status: 403 },
      );
    const result = await withTaskTopology(async (tx) => {
      const task = await tx.task.findUnique({ where: { id } });
      if (!task)
        throw Object.assign(new Error("Task not found"), { status: 404 });
      await taskAncestry(tx, task);
      if (sprintId) {
        const sprint = await tx.sprint.findUnique({ where: { id: sprintId } });
        if (!sprint)
          throw Object.assign(new Error("Sprint not found"), { status: 404 });
        if (sprint.projectId !== task.projectId)
          throw hierarchyConflict(
            "Task and sprint must belong to the same project.",
          );
      }
      const subtree = await taskSubtree(tx, task);
      const changed = new Set(subtree.map((entry) => entry.task.id));
      const detach = !!task.parentTaskId && sprintId !== task.sprintId;
      await tx.task.updateMany({
        where: { id: { in: [...changed] } },
        data: { sprintId },
      });
      if (detach)
        await tx.task.update({ where: { id }, data: { parentTaskId: null } });
      const depth = detach ? 0 : (await taskAncestry(tx, task)).length - 1;
      await setSubtreeDepth(tx, subtree, depth, changed);
      if (detach) await recalculateProgress(tx, task.parentTaskId, changed);
      const updated = await this.changedTasks(tx, changed);
      return {
        task: updated.find((item) => item.id === id)!,
        subtasksUpdated: subtree.length - 1,
        updated,
      };
    });
    this.emitUpdates(result.updated);
    return { task: result.task, subtasksUpdated: result.subtasksUpdated };
  }

  async deleteAllTasks(): Promise<number> {
    const result = await withTaskTopology(async (tx) => {
      const deleted = await tx.task.findMany();
      await tx.task.deleteMany({});
      return deleted;
    });
    await this.emitDeleted(result);
    return result.length;
  }

  async deleteSprintTasks(sprintId: string): Promise<number> {
    const result = await withTaskTopology(async (tx) => {
      const deleted = await tx.task.findMany({ where: { sprintId } });
      for (const task of deleted) await taskSubtree(tx, task);
      await tx.task.deleteMany({ where: { sprintId } });
      const changed = new Set<string>();
      const deletedIds = new Set(deleted.map((task) => task.id));
      for (const task of deleted)
        if (task.parentTaskId && !deletedIds.has(task.parentTaskId))
          await recalculateProgress(tx, task.parentTaskId, changed);
      return { deleted, updated: await this.changedTasks(tx, changed) };
    });
    await this.emitDeleted(result.deleted);
    this.emitUpdates(result.updated);
    return result.deleted.length;
  }

  async deleteTaskSubtasks(taskId: string): Promise<number> {
    const result = await withTaskTopology(async (tx) => {
      const task = await tx.task.findUnique({ where: { id: taskId } });
      if (!task)
        throw Object.assign(new Error("Task not found"), { status: 404 });
      await taskAncestry(tx, task);
      const subtree = await taskSubtree(tx, task);
      const deleted = subtree.slice(1).map((entry) => entry.task);
      await tx.task.deleteMany({
        where: { id: { in: deleted.map((item) => item.id) } },
      });
      const changed = new Set<string>();
      if (deleted.length) await recalculateProgress(tx, taskId, changed);
      return { deleted, updated: await this.changedTasks(tx, changed) };
    });
    await this.emitDeleted(result.deleted);
    this.emitUpdates(result.updated);
    return result.deleted.length;
  }

  async deleteTask(
    id: string,
    cascade: boolean,
    userId: string,
    isAdmin: boolean,
  ) {
    const result = await withTaskTopology(async (tx) => {
      const task = await tx.task.findUnique({ where: { id } });
      if (!task)
        throw Object.assign(new Error("Task not found"), { status: 404 });
      if (!this.verifyTaskPermission(task, userId, isAdmin))
        throw Object.assign(new Error("No permission to delete this task"), {
          status: 403,
        });
      await taskAncestry(tx, task);
      const subtree = await taskSubtree(tx, task);
      if (subtree.length > 1 && !cascade)
        throw hierarchyConflict(
          `Task has ${subtree.length - 1} subtasks. Use cascade=true to delete all subtasks.`,
        );
      await tx.task.delete({ where: { id } });
      const changed = new Set<string>();
      await recalculateProgress(tx, task.parentTaskId, changed);
      return {
        deleted: subtree.map((entry) => entry.task),
        updated: await this.changedTasks(tx, changed),
      };
    });
    await this.emitDeleted(result.deleted);
    this.emitUpdates(result.updated);
  }

  private async validateAssignee(tx: Prisma.TransactionClient, id?: string) {
    if (!id) return;
    const user = await tx.user.findUnique({
      where: { id },
      select: { isActive: true },
    });
    if (!user?.isActive)
      throw Object.assign(new Error("Assigned user not found"), {
        status: 404,
      });
  }
  private changedTasks(tx: Prisma.TransactionClient, ids: Set<string>) {
    return tx.task.findMany({
      where: { id: { in: [...ids] } },
      include: taskRelations,
    });
  }
  private emitUpdates(tasks: Array<{ id: string }>) {
    try {
      const io = getSocketServer();
      for (const task of tasks) io.emit("task_updated", task);
    } catch {
      console.error("[Task] Realtime delivery unavailable");
    }
  }
  private async emitDeleted(
    tasks: Array<{
      id: string;
      createdById: string;
      assignedToId: string | null;
    }>,
  ) {
    for (const task of tasks) {
      try {
        await emitTenantEvent("task_deleted", task.id, {
          taskAcl: {
            createdById: task.createdById,
            assignedToId: task.assignedToId,
          },
        });
      } catch {
        console.error("[Task] Realtime delivery unavailable");
      }
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
      throw new Error("Task not found");
    }

    // Verify permission
    if (!this.verifyTaskPermission(task, userId, isAdmin)) {
      throw new Error("No permission to view this task");
    }

    // Get ancestors (path to root)
    const ancestors = await this.getAncestors(id, userId, isAdmin);

    // Get descendants (full subtree)
    const descendants = await this.getDescendantsTree(id, userId, isAdmin);

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
      throw new Error("Task not found");
    }

    // Verify permission
    if (!this.verifyTaskPermission(task, userId, isAdmin)) {
      throw new Error("No permission to view this task");
    }

    // Get all descendants
    const descendantIds = await this.getAllDescendantIds(id, userId, isAdmin);

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
      (t) => t.progress > 0 && t.progress < 100,
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
        (task.deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );

      // If we have start date, calculate if on track
      if (task.startDate) {
        const totalDays = Math.ceil(
          (task.deadline.getTime() - task.startDate.getTime()) /
            (1000 * 60 * 60 * 24),
        );
        const elapsedDays = Math.ceil(
          (now.getTime() - task.startDate.getTime()) / (1000 * 60 * 60 * 24),
        );
        const expectedProgress = (elapsedDays / totalDays) * 100;

        isOnTrack = overallProgress >= expectedProgress;

        // Estimate completion based on current velocity
        if (overallProgress > 0) {
          const velocity = overallProgress / elapsedDays; // % per day
          const remainingProgress = 100 - overallProgress;
          const estimatedDays = Math.ceil(remainingProgress / velocity);
          estimatedCompletion = new Date(
            now.getTime() + estimatedDays * 24 * 60 * 60 * 1000,
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
   * Helper: Verify if user has permission to access task
   */
  private verifyTaskPermission(
    task: { assignedToId: string | null; createdById: string },
    userId: string,
    isAdmin: boolean,
  ): boolean {
    if (isAdmin) return true;
    if (task.assignedToId === userId) return true;
    if (task.createdById === userId) return true;
    return false;
  }

  /** Each traversal edge observes the same task ACL as direct reads. */
  private async getAllDescendantIds(
    taskId: string,
    userId: string,
    isAdmin: boolean,
  ): Promise<string[]> {
    const descendants: string[] = [];
    const seen = new Set([taskId]);
    const getChildren = async (id: string) => {
      const children = await prisma.task.findMany({
        where: { parentTaskId: id, ...taskReadWhere(userId, isAdmin) },
        select: { id: true },
      });
      for (const child of children) {
        if (seen.has(child.id))
          throw hierarchyConflict("Task hierarchy contains a cycle.");
        seen.add(child.id);
        descendants.push(child.id);
        await getChildren(child.id);
      }
    };
    await getChildren(taskId);
    return descendants;
  }

  private async getAncestors(taskId: string, userId: string, isAdmin: boolean) {
    const ancestors: Array<{
      id: string;
      taskName: string;
      nestingLevel: number;
    }> = [];
    const seen = new Set<string>();
    let currentId: string | null = taskId;
    while (currentId) {
      if (seen.has(currentId))
        throw hierarchyConflict("Task hierarchy contains a cycle.");
      seen.add(currentId);
      const task = await prisma.task.findUnique({ where: { id: currentId } });
      if (!task || !this.verifyTaskPermission(task, userId, isAdmin)) break;
      if (task.id !== taskId)
        ancestors.unshift({
          id: task.id,
          taskName: task.taskName,
          nestingLevel: task.nestingLevel,
        });
      currentId = task.parentTaskId;
    }
    return ancestors;
  }

  private async getDescendantsTree(
    taskId: string,
    userId: string,
    isAdmin: boolean,
    seen = new Set<string>(),
  ): Promise<any[]> {
    if (seen.has(taskId))
      throw hierarchyConflict("Task hierarchy contains a cycle.");
    seen.add(taskId);
    const children = await prisma.task.findMany({
      where: { parentTaskId: taskId, ...taskReadWhere(userId, isAdmin) },
      select: { id: true, taskName: true, nestingLevel: true, progress: true },
    });
    const tree = [];
    for (const child of children)
      tree.push({
        ...child,
        children: await this.getDescendantsTree(
          child.id,
          userId,
          isAdmin,
          seen,
        ),
      });
    return tree;
  }
}

export const taskService = new TaskService();
