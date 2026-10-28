/**
 * Google Sheets Sync Service
 * Handles bidirectional sync between database and Google Sheets
 * Implements export, import, and bidirectional sync with conflict resolution
 */

import { Task, SyncLog, Prisma } from '@prisma/client';
import prisma from '@/database/client';
import { getGoogleSheetsClient } from './client';
import {
  tasksToSheetData,
  sheetDataToTasks,
  detectConflict,
  resolveConflict,
  SHEET_HEADERS,
} from './mapper';

/**
 * Conflict resolution strategies
 */
export type ConflictStrategy = 'lastWriterWins' | 'skipConflicts' | 'overwriteAll';

/**
 * Sync result interface
 */
export interface SyncResult {
  success: boolean;
  recordsExported: number;
  recordsImported: number;
  recordsUpdated: number;
  recordsSkipped: number;
  conflicts: Array<{
    taskId: string;
    taskName: string;
    resolution: 'useDb' | 'useSheet' | 'merge' | 'skip' | 'needsResolution';
    reason: string;
    dbDetails?: string;
    csvDetails?: string;
    conflictType?: 'duplicate' | 'update' | 'notesConflict';
  }>;
  syncLogId: string;
  duration: number;
  error?: string;
}

/**
 * Sync status interface
 */
export interface SyncStatus {
  lastSync: {
    id: string;
    syncType: string;
    status: string;
    createdAt: Date;
    duration: number;
    recordsExported: number;
    recordsImported: number;
    recordsUpdated: number;
    recordsSkipped: number;
    conflicts: number;
    error?: string;
  } | null;
  history: Array<{
    id: string;
    syncType: string;
    status: string;
    createdAt: Date;
    duration: number;
    spreadsheetId: string;
    sheetName: string;
  }>;
  serviceAccountEmail: string;
}

/**
 * Google Sheets Sync Service
 */
export class SyncService {
  private sheetsClient = getGoogleSheetsClient();

  /**
   * Export all tasks from database to Google Sheets
   */
  async exportToSheets(
    spreadsheetId: string,
    sheetName: string,
    overwrite: boolean,
    userId: string
  ): Promise<SyncResult> {
    const startTime = Date.now();
    const conflicts: SyncResult['conflicts'] = [];

    try {
      console.log(`[SyncService] Starting export to sheet: ${sheetName}`);

      // Verify spreadsheet access
      await this.sheetsClient.verifyAccess(spreadsheetId);
      console.log(`[SyncService] Spreadsheet access verified`);

      // Check if sheet exists, create if not
      const sheetExists = await this.sheetsClient.sheetExists(spreadsheetId, sheetName);
      if (!sheetExists) {
        console.log(`[SyncService] Sheet does not exist, creating: ${sheetName}`);
        await this.sheetsClient.createSheet(spreadsheetId, sheetName);
      }

      // Fetch all tasks from database with relations
      console.log(`[SyncService] Fetching tasks from database`);
      const tasks = await prisma.task.findMany({
        include: {
          sprint: true,
          assignedTo: true,
        },
        orderBy: [
          { nestingLevel: 'asc' },
          { createdAt: 'asc' },
        ],
      });

      console.log(`[SyncService] Found ${tasks.length} tasks to export`);

      // Transform tasks to sheet format
      const sheetData = tasksToSheetData(tasks);

      // Clear existing data if overwrite is true
      if (overwrite) {
        console.log(`[SyncService] Clearing existing sheet data`);
        await this.sheetsClient.clearSheet(spreadsheetId, `${sheetName}!A1:Z`);
      }

      // Batch update sheets with task data
      console.log(`[SyncService] Writing ${sheetData.length} rows to sheet`);
      await this.sheetsClient.writeSheet(
        spreadsheetId,
        `${sheetName}!A1`,
        sheetData
      );

      // Format headers (bold and freeze first row)
      const sheetId = await this.sheetsClient.getSheetId(spreadsheetId, sheetName);
      if (sheetId !== null) {
        await this.sheetsClient.formatHeaders(spreadsheetId, sheetId);
      }

      const duration = Date.now() - startTime;
      console.log(`[SyncService] Export completed in ${duration}ms`);

      // Create SyncLog entry
      const syncLog = await this.createSyncLog({
        spreadsheetId,
        sheetName,
        syncType: 'export',
        recordsExported: tasks.length,
        recordsImported: 0,
        recordsUpdated: 0,
        recordsSkipped: 0,
        conflicts: 0,
        status: 'completed',
        duration,
        performedById: userId,
      });

      return {
        success: true,
        recordsExported: tasks.length,
        recordsImported: 0,
        recordsUpdated: 0,
        recordsSkipped: 0,
        conflicts: [],
        syncLogId: syncLog.id,
        duration,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error(`[SyncService] Export failed:`, error);

      // Create failed SyncLog entry
      const syncLog = await this.createSyncLog({
        spreadsheetId,
        sheetName,
        syncType: 'export',
        recordsExported: 0,
        recordsImported: 0,
        recordsUpdated: 0,
        recordsSkipped: 0,
        conflicts: 0,
        status: 'failed',
        error: error.message,
        duration,
        performedById: userId,
      });

      return {
        success: false,
        recordsExported: 0,
        recordsImported: 0,
        recordsUpdated: 0,
        recordsSkipped: 0,
        conflicts: [],
        syncLogId: syncLog.id,
        duration,
        error: error.message,
      };
    }
  }

  /**
   * Import tasks from Google Sheets to database
   */
  async importFromSheets(
    spreadsheetId: string,
    sheetName: string,
    conflictStrategy: ConflictStrategy,
    userId: string
  ): Promise<SyncResult> {
    const startTime = Date.now();
    const conflicts: SyncResult['conflicts'] = [];
    let recordsImported = 0;
    let recordsUpdated = 0;
    let recordsSkipped = 0;

    try {
      console.log(`[SyncService] Starting import from sheet: ${sheetName}`);

      // Verify spreadsheet access
      await this.sheetsClient.verifyAccess(spreadsheetId);

      // Check if sheet exists
      const sheetExists = await this.sheetsClient.sheetExists(spreadsheetId, sheetName);
      if (!sheetExists) {
        throw new Error(`Sheet "${sheetName}" does not exist in the spreadsheet`);
      }

      // Read all rows from sheet
      console.log(`[SyncService] Reading sheet data`);
      const rows = await this.sheetsClient.readSheet(spreadsheetId, `${sheetName}!A1:Z`);

      if (!rows || rows.length === 0) {
        throw new Error('Sheet is empty or has no data');
      }

      // Verify headers
      const headers = rows[0];
      if (!this.validateHeaders(headers)) {
        throw new Error('Invalid sheet headers. Please ensure the sheet has the correct column structure.');
      }

      // Parse rows to tasks
      console.log(`[SyncService] Parsing ${rows.length - 1} rows`);
      const parsedTasks = await sheetDataToTasks(rows, true);

      // Filter out parsing errors
      const validTasks = parsedTasks.filter((item) => !item.error);
      const invalidTasks = parsedTasks.filter((item) => item.error);

      if (invalidTasks.length > 0) {
        console.warn(`[SyncService] ${invalidTasks.length} rows failed validation:`, invalidTasks);
      }

      console.log(`[SyncService] Successfully parsed ${validTasks.length} tasks`);

      // Get last sync time for conflict detection
      const lastSyncTime = await this.getLastSyncTime(spreadsheetId);

      // Process tasks in transaction
      await prisma.$transaction(async (tx) => {
        for (const { task, rowIndex } of validTasks) {
          try {
            // Validate task data
            this.validateTaskData(task);

            // First, check if task exists by ID
            let existingTask = await tx.task.findUnique({
              where: { id: task.id },
            });

            // If not found by ID, check for smart duplicate
            // (same taskName + sprintId + parentTaskId combination)
            if (!existingTask) {
              const duplicateCheckWhere: any = {
                taskName: task.taskName,
                sprintId: task.sprintId,
              };

              // For subtasks, also match by parent
              if (task.parentTaskId) {
                duplicateCheckWhere.parentTaskId = task.parentTaskId;
              } else {
                duplicateCheckWhere.parentTaskId = null;
              }

              existingTask = await tx.task.findFirst({
                where: duplicateCheckWhere,
              });

              if (existingTask) {
                // Found a duplicate based on task characteristics
                console.log(
                  `[SyncService] Found duplicate task by characteristics: ${existingTask.id} matches row ${rowIndex + 1}`
                );

                // Check if details/notes differ
                const notesDiffer =
                  (existingTask.details || '') !== (task.details || '');

                if (notesDiffer) {
                  // Notes conflict - add to conflicts for user resolution
                  conflicts.push({
                    taskId: existingTask.id,
                    taskName: task.taskName!,
                    resolution: 'needsResolution',
                    reason: `Duplicate task found with different notes`,
                    dbDetails: existingTask.details || '(empty)',
                    csvDetails: task.details || '(empty)',
                    conflictType: 'notesConflict',
                  });
                  recordsSkipped++;
                  continue;
                }

                // No notes conflict, skip this duplicate
                conflicts.push({
                  taskId: existingTask.id,
                  taskName: task.taskName!,
                  resolution: 'skip',
                  reason: `Duplicate task skipped (same name, sprint, parent)`,
                  conflictType: 'duplicate',
                });
                recordsSkipped++;
                continue;
              }
            }

            if (existingTask) {
              // Task exists (by ID) - check for conflicts
              const hasConflict = detectConflict(existingTask, task, lastSyncTime);

              if (hasConflict) {
                // Apply conflict resolution
                const resolution = resolveConflict(existingTask, task, conflictStrategy);

                conflicts.push({
                  taskId: task.id!,
                  taskName: task.taskName!,
                  resolution,
                  reason: `Both database and sheet were updated since last sync`,
                });

                if (resolution === 'skip') {
                  recordsSkipped++;
                  continue;
                } else if (resolution === 'useDb') {
                  recordsSkipped++;
                  continue;
                }
                // resolution === 'useSheet' falls through to update
              }

              // Update existing task
              await tx.task.update({
                where: { id: existingTask.id },
                data: {
                  taskName: task.taskName!,
                  details: task.details,
                  progress: task.progress!,
                  sprintId: task.sprintId!,
                  assignedToId: task.assignedToId!,
                  startDate: task.startDate!,
                  deadline: task.deadline!,
                  nestingLevel: task.nestingLevel!,
                  parentTaskId: task.parentTaskId,
                  updatedAt: new Date(),
                },
              });

              recordsUpdated++;
              console.log(`[SyncService] Updated task: ${existingTask.id}`);
            } else {
              // Create new task
              await tx.task.create({
                data: {
                  id: task.id!,
                  taskName: task.taskName!,
                  details: task.details,
                  progress: task.progress!,
                  sprintId: task.sprintId!,
                  assignedToId: task.assignedToId!,
                  startDate: task.startDate!,
                  deadline: task.deadline!,
                  nestingLevel: task.nestingLevel!,
                  parentTaskId: task.parentTaskId,
                  createdById: userId,
                  createdAt: task.createdAt || new Date(),
                  updatedAt: task.updatedAt || new Date(),
                },
              });

              recordsImported++;
              console.log(`[SyncService] Created task: ${task.id}`);
            }
          } catch (error: any) {
            console.error(`[SyncService] Failed to process task at row ${rowIndex}:`, error);
            recordsSkipped++;
            conflicts.push({
              taskId: task.id || 'unknown',
              taskName: task.taskName || 'unknown',
              resolution: 'skip',
              reason: `Processing failed: ${error.message}`,
            });
          }
        }
      });

      const duration = Date.now() - startTime;
      console.log(`[SyncService] Import completed in ${duration}ms`);

      // Create SyncLog entry
      const syncLog = await this.createSyncLog({
        spreadsheetId,
        sheetName,
        syncType: 'import',
        recordsExported: 0,
        recordsImported,
        recordsUpdated,
        recordsSkipped,
        conflicts: conflicts.length,
        status: conflicts.length > 0 ? 'partial' : 'completed',
        duration,
        performedById: userId,
      });

      return {
        success: true,
        recordsExported: 0,
        recordsImported,
        recordsUpdated,
        recordsSkipped,
        conflicts,
        syncLogId: syncLog.id,
        duration,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error(`[SyncService] Import failed:`, error);

      // Create failed SyncLog entry
      const syncLog = await this.createSyncLog({
        spreadsheetId,
        sheetName,
        syncType: 'import',
        recordsExported: 0,
        recordsImported,
        recordsUpdated,
        recordsSkipped,
        conflicts: conflicts.length,
        status: 'failed',
        error: error.message,
        duration,
        performedById: userId,
      });

      return {
        success: false,
        recordsExported: 0,
        recordsImported,
        recordsUpdated,
        recordsSkipped,
        conflicts,
        syncLogId: syncLog.id,
        duration,
        error: error.message,
      };
    }
  }

  /**
   * Perform bidirectional sync between database and Google Sheets
   */
  async bidirectionalSync(
    spreadsheetId: string,
    sheetName: string,
    conflictStrategy: ConflictStrategy,
    userId: string
  ): Promise<SyncResult> {
    const startTime = Date.now();
    const conflicts: SyncResult['conflicts'] = [];
    let recordsExported = 0;
    let recordsImported = 0;
    let recordsUpdated = 0;
    let recordsSkipped = 0;

    try {
      console.log(`[SyncService] Starting bidirectional sync for sheet: ${sheetName}`);

      // Verify spreadsheet access
      await this.sheetsClient.verifyAccess(spreadsheetId);

      // Check if sheet exists
      const sheetExists = await this.sheetsClient.sheetExists(spreadsheetId, sheetName);
      if (!sheetExists) {
        throw new Error(`Sheet "${sheetName}" does not exist in the spreadsheet`);
      }

      // Get last sync timestamp
      const lastSyncTime = await this.getLastSyncTime(spreadsheetId);
      console.log(`[SyncService] Last sync time:`, lastSyncTime);

      // Read sheets data
      console.log(`[SyncService] Reading sheet data`);
      const rows = await this.sheetsClient.readSheet(spreadsheetId, `${sheetName}!A1:Z`);

      if (!rows || rows.length === 0) {
        throw new Error('Sheet is empty or has no data');
      }

      // Validate headers
      if (!this.validateHeaders(rows[0])) {
        throw new Error('Invalid sheet headers');
      }

      // Parse sheet tasks
      const parsedSheetTasks = await sheetDataToTasks(rows, true);
      const sheetTasksMap = new Map<string, Partial<Task>>();

      parsedSheetTasks.forEach(({ task, error }) => {
        if (!error && task.id) {
          sheetTasksMap.set(task.id, task);
        }
      });

      console.log(`[SyncService] Found ${sheetTasksMap.size} valid tasks in sheet`);

      // Fetch database tasks updated since last sync
      const dbTasks = await prisma.task.findMany({
        include: {
          sprint: true,
          assignedTo: true,
        },
      });

      console.log(`[SyncService] Found ${dbTasks.length} tasks in database`);

      // Create task maps for comparison
      const dbTasksMap = new Map<string, typeof dbTasks[0]>();
      dbTasks.forEach((task) => {
        dbTasksMap.set(task.id, task);
      });

      // Identify changes
      const dbOnlyChanges: string[] = [];
      const sheetOnlyChanges: string[] = [];
      const bothChanged: string[] = [];

      // Find DB tasks not in sheet or changed
      for (const [taskId, dbTask] of dbTasksMap) {
        const sheetTask = sheetTasksMap.get(taskId);

        if (!sheetTask) {
          // Task exists only in DB
          dbOnlyChanges.push(taskId);
        } else {
          // Check if both changed since last sync
          const hasConflict = detectConflict(dbTask, sheetTask, lastSyncTime);
          if (hasConflict) {
            bothChanged.push(taskId);
          }
        }
      }

      // Find sheet tasks not in DB
      for (const taskId of sheetTasksMap.keys()) {
        if (!dbTasksMap.has(taskId)) {
          sheetOnlyChanges.push(taskId);
        }
      }

      console.log(`[SyncService] Changes detected - DB: ${dbOnlyChanges.length}, Sheet: ${sheetOnlyChanges.length}, Both: ${bothChanged.length}`);

      // Process changes in transaction
      await prisma.$transaction(async (tx) => {
        // Handle DB-only changes: Update sheet
        if (dbOnlyChanges.length > 0) {
          console.log(`[SyncService] Updating ${dbOnlyChanges.length} tasks in sheet from DB`);
          recordsExported += dbOnlyChanges.length;
        }

        // Handle sheet-only changes: Update DB
        for (const taskId of sheetOnlyChanges) {
          const sheetTask = sheetTasksMap.get(taskId)!;

          try {
            this.validateTaskData(sheetTask);

            const existingTask = await tx.task.findUnique({
              where: { id: taskId },
            });

            if (existingTask) {
              await tx.task.update({
                where: { id: taskId },
                data: {
                  taskName: sheetTask.taskName!,
                  details: sheetTask.details,
                  progress: sheetTask.progress!,
                  sprintId: sheetTask.sprintId!,
                  assignedToId: sheetTask.assignedToId!,
                  startDate: sheetTask.startDate!,
                  deadline: sheetTask.deadline!,
                  nestingLevel: sheetTask.nestingLevel!,
                  parentTaskId: sheetTask.parentTaskId,
                  updatedAt: new Date(),
                },
              });
              recordsUpdated++;
            } else {
              await tx.task.create({
                data: {
                  id: sheetTask.id!,
                  taskName: sheetTask.taskName!,
                  details: sheetTask.details,
                  progress: sheetTask.progress!,
                  sprintId: sheetTask.sprintId!,
                  assignedToId: sheetTask.assignedToId!,
                  startDate: sheetTask.startDate!,
                  deadline: sheetTask.deadline!,
                  nestingLevel: sheetTask.nestingLevel!,
                  parentTaskId: sheetTask.parentTaskId,
                  createdById: userId,
                  createdAt: sheetTask.createdAt || new Date(),
                  updatedAt: sheetTask.updatedAt || new Date(),
                },
              });
              recordsImported++;
            }
          } catch (error: any) {
            console.error(`[SyncService] Failed to process sheet task ${taskId}:`, error);
            recordsSkipped++;
            conflicts.push({
              taskId,
              taskName: sheetTask.taskName || 'unknown',
              resolution: 'skip',
              reason: `Processing failed: ${error.message}`,
            });
          }
        }

        // Handle conflicts (both changed): Apply conflict strategy
        for (const taskId of bothChanged) {
          const dbTask = dbTasksMap.get(taskId)!;
          const sheetTask = sheetTasksMap.get(taskId)!;

          const resolution = resolveConflict(dbTask, sheetTask, conflictStrategy);

          conflicts.push({
            taskId,
            taskName: dbTask.taskName,
            resolution,
            reason: 'Both database and sheet were updated since last sync',
          });

          if (resolution === 'skip') {
            recordsSkipped++;
          } else if (resolution === 'useDb') {
            // DB wins - sheet will be updated later
            recordsSkipped++;
          } else if (resolution === 'useSheet') {
            // Sheet wins - update DB
            try {
              this.validateTaskData(sheetTask);

              await tx.task.update({
                where: { id: taskId },
                data: {
                  taskName: sheetTask.taskName!,
                  details: sheetTask.details,
                  progress: sheetTask.progress!,
                  sprintId: sheetTask.sprintId!,
                  assignedToId: sheetTask.assignedToId!,
                  startDate: sheetTask.startDate!,
                  deadline: sheetTask.deadline!,
                  nestingLevel: sheetTask.nestingLevel!,
                  parentTaskId: sheetTask.parentTaskId,
                  updatedAt: new Date(),
                },
              });
              recordsUpdated++;
            } catch (error: any) {
              console.error(`[SyncService] Failed to resolve conflict for ${taskId}:`, error);
              recordsSkipped++;
            }
          }
        }
      });

      // Update sheet with final DB state
      console.log(`[SyncService] Updating sheet with final state`);
      const finalTasks = await prisma.task.findMany({
        include: {
          sprint: true,
          assignedTo: true,
        },
        orderBy: [
          { nestingLevel: 'asc' },
          { createdAt: 'asc' },
        ],
      });

      const sheetData = tasksToSheetData(finalTasks);
      await this.sheetsClient.clearSheet(spreadsheetId, `${sheetName}!A1:Z`);
      await this.sheetsClient.writeSheet(spreadsheetId, `${sheetName}!A1`, sheetData);

      const duration = Date.now() - startTime;
      console.log(`[SyncService] Bidirectional sync completed in ${duration}ms`);

      // Create SyncLog entry
      const syncLog = await this.createSyncLog({
        spreadsheetId,
        sheetName,
        syncType: 'bidirectional',
        recordsExported,
        recordsImported,
        recordsUpdated,
        recordsSkipped,
        conflicts: conflicts.length,
        status: conflicts.length > 0 ? 'partial' : 'completed',
        duration,
        performedById: userId,
      });

      return {
        success: true,
        recordsExported,
        recordsImported,
        recordsUpdated,
        recordsSkipped,
        conflicts,
        syncLogId: syncLog.id,
        duration,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      console.error(`[SyncService] Bidirectional sync failed:`, error);

      // Create failed SyncLog entry
      const syncLog = await this.createSyncLog({
        spreadsheetId,
        sheetName,
        syncType: 'bidirectional',
        recordsExported,
        recordsImported,
        recordsUpdated,
        recordsSkipped,
        conflicts: conflicts.length,
        status: 'failed',
        error: error.message,
        duration,
        performedById: userId,
      });

      return {
        success: false,
        recordsExported,
        recordsImported,
        recordsUpdated,
        recordsSkipped,
        conflicts,
        syncLogId: syncLog.id,
        duration,
        error: error.message,
      };
    }
  }

  /**
   * Get sync status and history
   */
  async getSyncStatus(userId: string, spreadsheetId?: string): Promise<SyncStatus> {
    try {
      console.log(`[SyncService] Getting sync status for user: ${userId}`);

      // Build query filter
      const where: Prisma.SyncLogWhereInput = {
        performedById: userId,
      };

      if (spreadsheetId) {
        where.spreadsheetId = spreadsheetId;
      }

      // Get most recent sync
      const lastSync = await prisma.syncLog.findFirst({
        where,
        orderBy: { createdAt: 'desc' },
      });

      // Get sync history (last 10)
      const history = await prisma.syncLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          syncType: true,
          status: true,
          createdAt: true,
          duration: true,
          spreadsheetId: true,
          sheetName: true,
        },
      });

      // Get service account email
      const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || 'Not configured';

      return {
        lastSync: lastSync
          ? {
              id: lastSync.id,
              syncType: lastSync.syncType,
              status: lastSync.status,
              createdAt: lastSync.createdAt,
              duration: lastSync.duration,
              recordsExported: lastSync.recordsExported,
              recordsImported: lastSync.recordsImported,
              recordsUpdated: lastSync.recordsUpdated,
              recordsSkipped: lastSync.recordsSkipped,
              conflicts: lastSync.conflicts,
              error: lastSync.error || undefined,
            }
          : null,
        history,
        serviceAccountEmail,
      };
    } catch (error: any) {
      console.error(`[SyncService] Failed to get sync status:`, error);
      throw new Error(`Failed to get sync status: ${error.message}`);
    }
  }

  /**
   * Private helper: Create sync log entry
   */
  private async createSyncLog(data: {
    spreadsheetId: string;
    sheetName: string;
    syncType: string;
    recordsExported: number;
    recordsImported: number;
    recordsUpdated: number;
    recordsSkipped: number;
    conflicts: number;
    status: string;
    error?: string;
    duration: number;
    performedById: string;
  }): Promise<SyncLog> {
    try {
      return await prisma.syncLog.create({
        data: {
          spreadsheetId: data.spreadsheetId,
          sheetName: data.sheetName,
          syncType: data.syncType,
          recordsExported: data.recordsExported,
          recordsImported: data.recordsImported,
          recordsUpdated: data.recordsUpdated,
          recordsSkipped: data.recordsSkipped,
          conflicts: data.conflicts,
          status: data.status,
          error: data.error,
          duration: data.duration,
          performedById: data.performedById,
        },
      });
    } catch (error: any) {
      console.error(`[SyncService] Failed to create sync log:`, error);
      throw new Error(`Failed to create sync log: ${error.message}`);
    }
  }

  /**
   * Private helper: Get last sync time for spreadsheet
   */
  private async getLastSyncTime(spreadsheetId: string): Promise<Date | null> {
    try {
      const lastSync = await prisma.syncLog.findFirst({
        where: {
          spreadsheetId,
          status: { in: ['completed', 'partial'] },
        },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      });

      return lastSync ? lastSync.createdAt : null;
    } catch (error: any) {
      console.error(`[SyncService] Failed to get last sync time:`, error);
      return null;
    }
  }

  /**
   * Private helper: Validate task data
   */
  private validateTaskData(task: Partial<Task>): void {
    if (!task.id || !task.taskName) {
      throw new Error('Task ID and Task Name are required');
    }

    if (task.progress !== undefined && (task.progress < 0 || task.progress > 100)) {
      throw new Error('Progress must be between 0 and 100');
    }

    if (task.nestingLevel !== undefined && (task.nestingLevel < 0 || task.nestingLevel > 3)) {
      throw new Error('Nesting level must be between 0 and 3');
    }

    if (!task.sprintId) {
      throw new Error('Sprint ID is required');
    }

    if (!task.assignedToId) {
      throw new Error('Assigned To ID is required');
    }

    if (!task.startDate || !task.deadline) {
      throw new Error('Start Date and Deadline are required');
    }

    if (task.startDate && task.deadline && task.deadline < task.startDate) {
      throw new Error('Deadline must be after start date');
    }
  }

  /**
   * Private helper: Validate sheet headers
   */
  private validateHeaders(headers: any[]): boolean {
    if (!headers || headers.length !== SHEET_HEADERS.length) {
      return false;
    }

    return SHEET_HEADERS.every((header, index) => headers[index] === header);
  }

  /**
   * Resolve note conflicts from import
   */
  async resolveConflicts(
    spreadsheetId: string,
    sheetName: string,
    resolutions: Array<{ taskId: string; resolution: 'useDb' | 'useSheet' | 'merge' }>,
    userId: string
  ): Promise<SyncResult> {
    const startTime = Date.now();
    const conflicts: SyncResult['conflicts'] = [];
    let recordsUpdated = 0;

    try {
      console.log(`[SyncService] Resolving ${resolutions.length} conflicts`);

      // Verify spreadsheet access
      await this.sheetsClient.verifyAccess(spreadsheetId);

      // Read sheet data to get CSV notes
      const rows = await this.sheetsClient.readSheet(spreadsheetId, `${sheetName}!A1:Z`);

      if (!rows || rows.length === 0) {
        throw new Error('Sheet is empty or has no data');
      }

      // Parse sheet tasks
      const parsedSheetTasks = await sheetDataToTasks(rows, true);
      const sheetTasksMap = new Map<string, Partial<Task>>();

      parsedSheetTasks.forEach(({ task, error }) => {
        if (!error && task.id) {
          sheetTasksMap.set(task.id, task);
        }
      });

      // Process resolutions in transaction
      await prisma.$transaction(async (tx) => {
        for (const resolution of resolutions) {
          const { taskId, resolution: choice } = resolution;

          // Get DB task
          const dbTask = await tx.task.findUnique({
            where: { id: taskId },
          });

          if (!dbTask) {
            console.warn(`[SyncService] Task ${taskId} not found in DB, skipping`);
            continue;
          }

          // Get sheet task
          const sheetTask = sheetTasksMap.get(taskId);

          if (!sheetTask) {
            console.warn(`[SyncService] Task ${taskId} not found in sheet, skipping`);
            continue;
          }

          let newDetails: string | null = null;

          // Apply resolution
          switch (choice) {
            case 'useDb':
              // Keep current DB notes - no update needed
              newDetails = dbTask.details;
              console.log(`[SyncService] Keeping DB notes for task ${taskId}`);
              break;

            case 'useSheet':
              // Use CSV notes
              newDetails = sheetTask.details || null;
              console.log(`[SyncService] Using CSV notes for task ${taskId}`);
              break;

            case 'merge': {
              // Merge both notes
              const dbNotes = dbTask.details || '';
              const csvNotes = sheetTask.details || '';
              newDetails = dbNotes && csvNotes
                ? `${dbNotes}\n\n---\n\n${csvNotes}`
                : dbNotes || csvNotes || null;
              console.log(`[SyncService] Merging notes for task ${taskId}`);
              break;
            }
          }

          // Update task if notes changed
          if (newDetails !== dbTask.details) {
            await tx.task.update({
              where: { id: taskId },
              data: { details: newDetails },
            });
            recordsUpdated++;
          }

          conflicts.push({
            taskId,
            taskName: dbTask.taskName || 'Unknown',
            resolution: choice,
            reason: `Resolved with ${choice}`,
            conflictType: 'notesConflict',
          });
        }
      });

      const duration = Date.now() - startTime;

      // Create sync log
      const syncLog = await this.createSyncLog({
        spreadsheetId,
        sheetName,
        syncType: 'resolve_conflicts',
        recordsExported: 0,
        recordsImported: 0,
        recordsUpdated,
        recordsSkipped: 0,
        conflicts: conflicts.length,
        status: 'completed',
        duration,
        performedById: userId,
      });

      console.log(`[SyncService] Conflicts resolved successfully: ${recordsUpdated} tasks updated`);

      return {
        success: true,
        recordsExported: 0,
        recordsImported: 0,
        recordsUpdated,
        recordsSkipped: 0,
        conflicts,
        syncLogId: syncLog.id,
        duration,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;

      console.error(`[SyncService] Conflict resolution failed:`, error);

      // Create failed sync log
      await this.createSyncLog({
        spreadsheetId,
        sheetName,
        syncType: 'resolve_conflicts',
        recordsExported: 0,
        recordsImported: 0,
        recordsUpdated,
        recordsSkipped: 0,
        conflicts: conflicts.length,
        status: 'failed',
        error: error.message,
        duration,
        performedById: userId,
      });

      throw error;
    }
  }
}

// Singleton instance
let serviceInstance: SyncService | null = null;

export function getSyncService(): SyncService {
  if (!serviceInstance) {
    serviceInstance = new SyncService();
  }
  return serviceInstance;
}

export default SyncService;
