/**
 * Data Mapper for Google Sheets <-> Database Transformation
 * Handles field mapping and format conversion
 */

import { Task, Sprint, User } from '@prisma/client';
import prisma from '@/database/client';

/**
 * Sheet column headers (must match exactly)
 */
export const SHEET_HEADERS = [
  'Task ID',
  'Task Name',
  'Details',
  'Progress %',
  'Sprint',
  'Assigned To',
  'Start Date',
  'Deadline',
  'Nesting Level',
  'Parent ID',
  'Created At',
  'Updated At',
];

/**
 * Task with relations for export
 */
type TaskWithRelations = Task & {
  sprint: Sprint | null;
  assignedTo: User | null;
};

/**
 * Transform a database task to a sheet row
 */
export function taskToSheetRow(task: TaskWithRelations): any[] {
  return [
    task.id,
    task.taskName,
    task.details || '',
    task.progress,
    task.sprint?.name || '',
    task.assignedTo?.name || '',
    task.startDate ? formatDate(task.startDate) : '',
    task.deadline ? formatDate(task.deadline) : '',
    task.nestingLevel,
    task.parentTaskId || '',
    task.createdAt.toISOString(),
    task.updatedAt.toISOString(),
  ];
}

/**
 * Transform multiple tasks to sheet rows (with headers)
 */
export function tasksToSheetData(tasks: TaskWithRelations[]): any[][] {
  const rows = tasks.map(taskToSheetRow);
  return [SHEET_HEADERS, ...rows];
}

/**
 * Parse a sheet row to a task object
 */
export async function sheetRowToTask(
  row: any[],
  rowIndex: number
): Promise<Partial<Task> | null> {
  try {
    // Skip if row is empty or header
    if (!row || row.length === 0 || rowIndex === 0) {
      return null;
    }

    // Extract values (handle missing columns)
    const [
      taskId,
      taskName,
      details,
      progressStr,
      sprintName,
      assignedToName,
      startDateStr,
      deadlineStr,
      nestingLevelStr,
      parentIdStr,
      createdAtStr,
      updatedAtStr,
    ] = row;

    // Validate required fields
    if (!taskId || !taskName) {
      throw new Error(`Row ${rowIndex + 1}: Missing required fields (Task ID or Task Name)`);
    }

    // Parse progress
    const progress = parseInt(progressStr) || 0;
    if (progress < 0 || progress > 100) {
      throw new Error(`Row ${rowIndex + 1}: Progress must be between 0 and 100`);
    }

    // Parse nesting level
    const nestingLevel = parseInt(nestingLevelStr) || 0;
    if (nestingLevel < 0 || nestingLevel > 3) {
      throw new Error(`Row ${rowIndex + 1}: Nesting level must be between 0 and 3`);
    }

    // Resolve sprint ID from name
    let sprintId: string | null = null;
    if (sprintName && sprintName.trim()) {
      const sprint = await prisma.sprint.findFirst({
        where: { name: sprintName.trim() },
      });
      if (!sprint) {
        throw new Error(`Row ${rowIndex + 1}: Sprint "${sprintName}" not found`);
      }
      sprintId = sprint.id;
    }

    // Resolve assigned user ID from name
    let assignedToId: string | null = null;
    if (assignedToName && assignedToName.trim()) {
      const user = await prisma.user.findFirst({
        where: { name: assignedToName.trim() },
      });
      if (!user) {
        throw new Error(`Row ${rowIndex + 1}: User "${assignedToName}" not found`);
      }
      assignedToId = user.id;
    }

    // Parse dates
    const startDate = startDateStr ? parseDate(startDateStr) : null;
    const deadline = deadlineStr ? parseDate(deadlineStr) : null;
    const createdAt = createdAtStr ? parseDate(createdAtStr) : new Date();
    const updatedAt = updatedAtStr ? parseDate(updatedAtStr) : new Date();

    // Validate date order
    if (startDate && deadline && deadline < startDate) {
      throw new Error(`Row ${rowIndex + 1}: Deadline must be after start date`);
    }

    // Build task object
    const task: Partial<Task> = {
      id: taskId.trim(),
      taskName: taskName.trim(),
      details: details ? details.trim() : null,
      progress,
      sprintId: sprintId || '',
      assignedToId: assignedToId || '',
      startDate: startDate || new Date(),
      deadline: deadline || new Date(),
      nestingLevel,
      parentTaskId: parentIdStr && parentIdStr.trim() ? parentIdStr.trim() : null,
      createdAt,
      updatedAt,
    };

    return task;
  } catch (error: any) {
    throw new Error(`Failed to parse row ${rowIndex + 1}: ${error.message}`);
  }
}

/**
 * Parse multiple sheet rows to tasks
 */
export async function sheetDataToTasks(
  rows: any[][],
  skipHeader = true
): Promise<Array<{ task: Partial<Task>; rowIndex: number; error?: string }>> {
  const results: Array<{ task: Partial<Task>; rowIndex: number; error?: string }> = [];

  const startIndex = skipHeader ? 1 : 0;

  for (let i = startIndex; i < rows.length; i++) {
    try {
      const task = await sheetRowToTask(rows[i], i);
      if (task) {
        results.push({ task, rowIndex: i });
      }
    } catch (error: any) {
      results.push({
        task: {} as Partial<Task>,
        rowIndex: i,
        error: error.message,
      });
    }
  }

  return results;
}

/**
 * Format date to YYYY-MM-DD
 */
function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Parse date from string (supports multiple formats)
 */
function parseDate(dateStr: string): Date | null {
  if (!dateStr || dateStr.trim() === '') {
    return null;
  }

  // Try ISO 8601 format
  let date = new Date(dateStr);
  if (!isNaN(date.getTime())) {
    return date;
  }

  // Try YYYY-MM-DD format
  const parts = dateStr.split('-');
  if (parts.length === 3) {
    const [year, month, day] = parts.map((p) => parseInt(p));
    date = new Date(year, month - 1, day);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }

  return null;
}

/**
 * Detect conflicts between database task and sheet task
 */
export function detectConflict(
  dbTask: Task,
  sheetTask: Partial<Task>,
  lastSyncTime: Date | null
): boolean {
  // If no last sync time, can't determine conflict
  if (!lastSyncTime) {
    return false;
  }

  // Check if DB task was updated after last sync
  const dbUpdatedAfterSync = dbTask.updatedAt > lastSyncTime;

  // Check if sheet task was updated after last sync
  const sheetUpdatedAfterSync = sheetTask.updatedAt
    ? sheetTask.updatedAt > lastSyncTime
    : false;

  // Conflict exists if both were updated after last sync
  return dbUpdatedAfterSync && sheetUpdatedAfterSync;
}

/**
 * Apply conflict resolution strategy
 */
export function resolveConflict(
  dbTask: Task,
  sheetTask: Partial<Task>,
  strategy: 'lastWriterWins' | 'skipConflicts' | 'overwriteAll'
): 'useDb' | 'useSheet' | 'skip' {
  switch (strategy) {
    case 'lastWriterWins':
      // Compare updatedAt timestamps
      if (!sheetTask.updatedAt) return 'useDb';
      return sheetTask.updatedAt > dbTask.updatedAt ? 'useSheet' : 'useDb';

    case 'skipConflicts':
      return 'skip';

    case 'overwriteAll':
      return 'useSheet';

    default:
      return 'skip';
  }
}

/**
 * Create lookup cache for sprints and users
 */
export async function createLookupCache() {
  const [sprints, users] = await Promise.all([
    prisma.sprint.findMany({
      select: { id: true, name: true },
    }),
    prisma.user.findMany({
      select: { id: true, name: true },
    }),
  ]);

  const sprintNameToId = new Map<string, string>();
  const sprintIdToName = new Map<string, string>();
  const userNameToId = new Map<string, string>();
  const userIdToName = new Map<string, string>();

  sprints.forEach((sprint) => {
    sprintNameToId.set(sprint.name, sprint.id);
    sprintIdToName.set(sprint.id, sprint.name);
  });

  users.forEach((user) => {
    userNameToId.set(user.name, user.id);
    userIdToName.set(user.id, user.name);
  });

  return {
    sprintNameToId,
    sprintIdToName,
    userNameToId,
    userIdToName,
  };
}
