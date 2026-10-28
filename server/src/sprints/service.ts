/**
 * Sprint Management Service
 * Business logic for sprint operations
 */

import { PrismaClient, Prisma } from "@prisma/client";
import prisma from "@/database/client";
import { withTaskTopology, taskReadWhere } from "@/tasks/hierarchy";
import {
  ListSprintsQuery,
  CreateSprint,
  UpdateSprint,
  GetSprintTasksQuery,
} from "./validators";

export class SprintService {
  /**
   * List sprints with filtering, sorting, and pagination
   */
  async listSprints(query: ListSprintsQuery) {
    const { page, limit, isActive, includeStats, sortBy, sortOrder } = query;

    // Build where clause
    const where: Prisma.SprintWhereInput = {};

    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Build orderBy
    const orderBy: Prisma.SprintOrderByWithRelationInput = {
      [sortBy]: sortOrder,
    };

    // Execute queries in parallel
    const [sprints, total] = await Promise.all([
      prisma.sprint.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        ...(includeStats && {
          include: {
            _count: {
              select: {
                tasks: true,
              },
            },
          },
        }),
      }),
      prisma.sprint.count({ where }),
    ]);

    return {
      sprints,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get sprint by ID
   */
  async getSprintById(
    id: string,
    includeTasks: boolean,
    userId: string,
    isAdmin: boolean,
  ) {
    const sprint = await prisma.sprint.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            tasks: { where: taskReadWhere(userId, isAdmin) },
          },
        },
        ...(includeTasks && {
          tasks: {
            where: taskReadWhere(userId, isAdmin),
            select: {
              id: true,
              taskName: true,
              progress: true,
              assignedTo: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
        }),
      },
    });

    return sprint;
  }

  /**
   * Create a new sprint
   */
  async createSprint(data: CreateSprint, userId: string) {
    const sprint = await prisma.sprint.create({
      data: {
        name: data.name,
        startDate: data.startDate,
        endDate: data.endDate,
        goal: data.goal,
        isActive: true,
        createdById: userId,
      },
    });

    return sprint;
  }

  /**
   * Update an existing sprint
   */
  async updateSprint(id: string, data: UpdateSprint) {
    // Check if sprint exists
    const existingSprint = await prisma.sprint.findUnique({
      where: { id },
    });

    if (!existingSprint) {
      throw new Error("Sprint not found");
    }

    // If updating dates, validate the new date range
    const startDate = data.startDate || existingSprint.startDate;
    const endDate = data.endDate || existingSprint.endDate;

    if (endDate <= startDate) {
      throw new Error("End date must be after start date");
    }

    // Update sprint
    const updatedSprint = await prisma.sprint.update({
      where: { id },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.startDate && { startDate: data.startDate }),
        ...(data.endDate && { endDate: data.endDate }),
        ...(data.goal !== undefined && { goal: data.goal }),
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });

    return updatedSprint;
  }

  /**
   * Delete a sprint
   */
  async deleteSprint(
    id: string,
    moveTasksToBacklog: boolean,
    deleteTasks: boolean = false,
  ) {
    if (deleteTasks && moveTasksToBacklog)
      throw new Error(
        "Cannot use both deleteTasks and moveTasksToBacklog options",
      );
    // Count and mutation share the topology lock with task creation and moves.
    // An empty-sprint check outside the transaction could miss a new task and
    // cascade-delete it without the caller choosing deleteTasks.
    await withTaskTopology(async (tx) => {
      const sprint = await tx.sprint.findUnique({
        where: { id },
        include: { _count: { select: { tasks: true } } },
      });
      if (!sprint) throw new Error("Sprint not found");
      if (sprint._count.tasks > 0 && !moveTasksToBacklog && !deleteTasks) {
        throw new Error(
          `Sprint has ${sprint._count.tasks} tasks. Use moveTasksToBacklog=true to move tasks or deleteTasks=true to delete all tasks.`,
        );
      }
      if (moveTasksToBacklog)
        await tx.task.updateMany({
          where: { sprintId: id },
          data: { sprintId: null },
        });
      await tx.sprint.delete({ where: { id } });
    });
  }

  /**
   * Get tasks in a sprint
   */
  async getSprintTasks(
    id: string,
    query: GetSprintTasksQuery,
    userId: string,
    isAdmin: boolean,
  ) {
    const { page, limit } = query;

    // Check if sprint exists
    const sprint = await prisma.sprint.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
      },
    });

    if (!sprint) {
      throw new Error("Sprint not found");
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Get tasks
    const [tasks, total] = await Promise.all([
      prisma.task.findMany({
        where: { sprintId: id, ...taskReadWhere(userId, isAdmin) },
        skip,
        take: limit,
        include: {
          assignedTo: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      }),
      prisma.task.count({
        where: { sprintId: id, ...taskReadWhere(userId, isAdmin) },
      }),
    ]);

    return {
      sprint,
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
   * Get currently active sprint
   */
  async getActiveSprint() {
    const now = new Date();

    const sprint = await prisma.sprint.findFirst({
      where: {
        isActive: true,
        startDate: {
          lte: now,
        },
        endDate: {
          gte: now,
        },
      },
      include: {
        _count: {
          select: {
            tasks: true,
          },
        },
      },
    });

    return sprint;
  }

  /**
   * Check if sprint dates overlap with existing sprints
   */
  async checkSprintOverlap(
    startDate: Date,
    endDate: Date,
    excludeId?: string,
  ): Promise<boolean> {
    // Build where clause
    const where: Prisma.SprintWhereInput = {
      AND: [
        {
          startDate: {
            lte: endDate,
          },
        },
        {
          endDate: {
            gte: startDate,
          },
        },
      ],
    };

    // Exclude current sprint if updating
    if (excludeId) {
      where.id = {
        not: excludeId,
      };
    }

    const overlappingSprint = await prisma.sprint.findFirst({
      where,
    });

    return overlappingSprint !== null;
  }
}

export const sprintService = new SprintService();
