import type { Prisma, Task } from "@prisma/client";
import prisma from "@/database/client";
import { getTenantContext } from "@/tenancy/context";

export function taskReadWhere(
  userId: string,
  isAdmin: boolean,
): Prisma.TaskWhereInput {
  return isAdmin
    ? {}
    : { OR: [{ createdById: userId }, { assignedToId: userId }] };
}

export function visibleSubtasks(
  userId: string,
  isAdmin: boolean,
  levels = 3,
): Prisma.TaskFindManyArgs {
  const where = taskReadWhere(userId, isAdmin);
  return levels > 1
    ? {
        where,
        include: { subtasks: visibleSubtasks(userId, isAdmin, levels - 1) },
      }
    : { where };
}

export function hierarchyConflict(message: string) {
  return Object.assign(new Error(message), {
    status: 409,
    code: "TASK_HIERARCHY_CONFLICT",
  });
}

/** All task topology/rollup writers take this transaction-scoped tenant lock first.
 * It also serializes opposite concurrent reparent requests across API replicas.
 */
export async function lockTaskTopology(tx: Prisma.TransactionClient) {
  const tenant = getTenantContext();
  await tx.$executeRawUnsafe("SET LOCAL lock_timeout = '5s'");
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${tenant.id}::text), 42404)`;
}

export async function withTaskTopology<T>(
  operation: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  try {
    return await prisma.$transaction(
      async (tx) => {
        await lockTaskTopology(tx);
        return operation(tx);
      },
      { maxWait: 10000, timeout: 20000 },
    );
  } catch (error: any) {
    if (
      error?.code === "P2028" ||
      error?.meta?.code === "55P03" ||
      error?.meta?.code === "40P01"
    ) {
      throw hierarchyConflict("Task hierarchy is busy. Reload and try again.");
    }
    throw error;
  }
}

/** Read the actual links rather than trusting client/stored nesting levels. */
export async function taskAncestry(
  tx: Prisma.TransactionClient,
  task: Task,
): Promise<Task[]> {
  const chain: Task[] = [];
  const seen = new Set<string>();
  let current: Task | null = task;
  while (current) {
    if (seen.has(current.id))
      throw hierarchyConflict("Task hierarchy contains a cycle.");
    seen.add(current.id);
    chain.unshift(current);
    if (chain.length > 4)
      throw hierarchyConflict("Maximum nesting depth (4 levels) reached.");
    if (!current.parentTaskId) break;
    const parent: Task | null = await tx.task.findUnique({
      where: { id: current.parentTaskId },
    });
    if (!parent)
      throw hierarchyConflict("Task hierarchy has a missing parent.");
    if (
      parent.sprintId !== current.sprintId ||
      parent.projectId !== current.projectId
    ) {
      throw hierarchyConflict(
        "Parent and child tasks must belong to the same project and sprint.",
      );
    }
    current = parent;
  }
  return chain;
}

export interface SubtreeEntry {
  task: Task;
  relativeDepth: number;
}
export async function taskSubtree(
  tx: Prisma.TransactionClient,
  task: Task,
): Promise<SubtreeEntry[]> {
  const result: SubtreeEntry[] = [{ task, relativeDepth: 0 }];
  const seen = new Set([task.id]);
  let level: Task[] = [task];
  let depth = 0;
  while (level.length) {
    const children = await tx.task.findMany({
      where: { parentTaskId: { in: level.map((item) => item.id) } },
    });
    depth += 1;
    for (const child of children) {
      if (seen.has(child.id))
        throw hierarchyConflict("Task hierarchy contains a cycle.");
      seen.add(child.id);
      if (depth > 3)
        throw hierarchyConflict("Maximum nesting depth (4 levels) reached.");
      if (
        child.sprintId !== task.sprintId ||
        child.projectId !== task.projectId
      ) {
        throw hierarchyConflict(
          "Parent and child tasks must belong to the same project and sprint.",
        );
      }
      result.push({ task: child, relativeDepth: depth });
    }
    level = children;
  }
  return result;
}

export async function setSubtreeDepth(
  tx: Prisma.TransactionClient,
  subtree: SubtreeEntry[],
  depth: number,
  changed: Set<string>,
) {
  if (subtree.some((item) => depth + item.relativeDepth > 3)) {
    throw hierarchyConflict(
      "Maximum nesting depth (4 levels) reached for this subtree.",
    );
  }
  for (const item of subtree) {
    const target = depth + item.relativeDepth;
    if (item.task.nestingLevel !== target) {
      await tx.task.update({
        where: { id: item.task.id },
        data: { nestingLevel: target },
      });
      changed.add(item.task.id);
    }
  }
}

/** A former parent with no remaining children resets to zero. */
export async function recalculateProgress(
  tx: Prisma.TransactionClient,
  parentId: string | null,
  changed: Set<string>,
) {
  const seen = new Set<string>();
  let id = parentId;
  while (id) {
    if (seen.has(id) || seen.size >= 4)
      throw hierarchyConflict(
        "Task hierarchy contains an invalid ancestor chain.",
      );
    seen.add(id);
    const parent = await tx.task.findUnique({ where: { id } });
    if (!parent) break;
    const children = await tx.task.findMany({
      where: { parentTaskId: id },
      select: { progress: true },
    });
    const progress = children.length
      ? Math.round(
          children.reduce((sum, child) => sum + child.progress, 0) /
            children.length,
        )
      : 0;
    if (parent.progress !== progress) {
      await tx.task.update({ where: { id }, data: { progress } });
      changed.add(id);
    }
    id = parent.parentTaskId;
  }
}
