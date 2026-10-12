/**
 * Upload Service
 * Business logic for file uploads and task import
 */

import prisma from '@/database/client';
import { Prisma } from '@prisma/client';
import path from 'path';
import fs from 'fs';
import { parseFile, validateTaskRows, validateHeaders, parseDate } from './parser';
import { TaskImportRow } from './validators';
import { sanitizeFilename } from './multer-config';

/**
 * Upload a generic file
 */
export async function uploadFile(
  file: Express.Multer.File,
  userId: string
) {
  if (!file) {
    throw new Error('No file provided');
  }

  // Create file record in database
  const fileRecord = await prisma.file.create({
    data: {
      filename: sanitizeFilename(file.originalname),
      storedFilename: file.filename,
      mimeType: file.mimetype,
      size: file.size,
      path: file.path,
      uploadedById: userId,
    },
    include: {
      uploadedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  console.log(`[Audit] User ${userId} uploaded file ${fileRecord.id} (${fileRecord.filename})`);

  return {
    id: fileRecord.id,
    filename: fileRecord.filename,
    mimeType: fileRecord.mimeType,
    size: fileRecord.size,
    url: `/api/upload/download/${fileRecord.id}`,
    uploadedBy: fileRecord.uploadedBy,
    createdAt: fileRecord.createdAt,
  };
}

/**
 * Upload a chat attachment
 */
export async function uploadChatAttachment(
  file: Express.Multer.File,
  userId: string,
  conversationId: string
) {
  if (!file) {
    throw new Error('No file provided');
  }

  // Verify conversation exists
  const conversation = await prisma.conversation.findUnique({
    where: { id: conversationId },
    include: {
      members: {
        where: { userId },
      },
    },
  });

  if (!conversation) {
    throw new Error('Conversation not found');
  }

  // Verify user is a member
  if (conversation.members.length === 0) {
    throw new Error('You are not a member of this conversation');
  }

  // Create file record
  const fileRecord = await prisma.file.create({
    data: {
      filename: sanitizeFilename(file.originalname),
      storedFilename: file.filename,
      mimeType: file.mimetype,
      size: file.size,
      path: file.path,
      uploadedById: userId,
      conversationId: conversationId,
    },
    include: {
      uploadedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });

  console.log(`[Audit] User ${userId} uploaded chat attachment ${fileRecord.id} to conversation ${conversationId}`);

  return {
    id: fileRecord.id,
    filename: fileRecord.filename,
    mimeType: fileRecord.mimeType,
    size: fileRecord.size,
    url: `/api/upload/download/${fileRecord.id}`,
    conversationId: fileRecord.conversationId,
    uploadedBy: fileRecord.uploadedBy,
    createdAt: fileRecord.createdAt,
  };
}

/**
 * Import tasks from CSV/Excel file
 */
export async function importTasksFromFile(
  file: Express.Multer.File,
  userId: string
) {
  if (!file) {
    throw new Error('No file provided');
  }

  try {
    // Log Prisma client info for debugging
    console.log(`[Import] ========== CSV IMPORT STARTED ==========`);
    console.log(`[Import] Prisma Client Version:`, Prisma.prismaVersion);
    console.log(`[Import] Environment:`, {
      NODE_ENV: process.env.NODE_ENV,
      DATABASE_URL: process.env.DATABASE_URL ? 'SET' : 'NOT SET',
    });

    // Parse file
    console.log(`[Import] Parsing file: ${file.path}`);
    const rows = await parseFile(file.path);
    console.log(`[Import] Parsed ${rows.length} rows`);

    // An empty file would otherwise be reported as "Missing required columns: No data"
    if (rows.length === 0) {
      throw new Error('File is empty. No rows to import.');
    }

    // Validate headers
    const headerValidation = validateHeaders(rows);
    if (!headerValidation.valid) {
      console.error(`[Import] Missing headers: ${headerValidation.missingHeaders.join(', ')}`);
      throw new Error(
        `Missing required columns: ${headerValidation.missingHeaders.join(', ')}`
      );
    }
    console.log('[Import] Headers validated successfully');

    // Validate rows
    const { valid, errors } = validateTaskRows(rows);
    console.log(`[Import] Valid rows: ${valid.length}, Validation errors: ${errors.length}`);

    // If all rows have errors, return early
    if (valid.length === 0 && errors.length > 0) {
      console.error('[Import] All rows have validation errors');
      return {
        imported: 0,
        skipped: errors.length,
        errors: errors.slice(0, 50), // Return first 50 errors
        tasks: [],
      };
    }

    // Process valid tasks
    // Each row creates:
    // 1. A parent task (from "Tasks" column) - OR reuses existing if already created
    // 2. Zero or more subtasks (from "Subtasks" column, comma-separated)
    const importedTasks: any[] = [];
    const importErrors: Array<{ row: number; error: string }> = [...errors];
    const taskMap = new Map<string, string>(); // taskName -> taskId (to avoid duplicates)
    console.log('[Import] Starting task creation...');
    console.log(`[Import] Processing ${valid.length} rows...`);

    // Process each row
    for (let i = 0; i < valid.length; i++) {
      const row = valid[i];

      try {
        // Step 1: Find or create the parent task from "Tasks" column
        const parentTaskName = row.Tasks.trim();
        console.log(`[Import] Row ${i + 2}: Processing parent task '${parentTaskName}'`);

        // Find or create sprint if specified
        let sprintId: string | null = null;
        if (row.Sprint && row.Sprint.trim() !== '') {
          const sprintName = row.Sprint.trim();
          console.log(`[Import] Row ${i + 2}: Looking for sprint '${sprintName}'`);

          let sprint = await prisma.sprint.findFirst({
            where: {
              name: sprintName,
            },
          });

          if (!sprint) {
            // Auto-create the sprint with default dates
            console.log(`[Import] Row ${i + 2}: Sprint '${sprintName}' not found - creating it`);
            const now = new Date();
            const twoWeeksLater = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

            sprint = await prisma.sprint.create({
              data: {
                name: sprintName,
                startDate: now,
                endDate: twoWeeksLater,
                status: 'ACTIVE',
                createdById: userId,
              },
            });
            console.log(`[Import] Row ${i + 2}: Created sprint '${sprintName}' (ID: ${sprint.id})`);
          }

          sprintId = sprint.id;
          console.log(`[Import] Row ${i + 2}: Using sprint ID: ${sprintId}`);
        } else {
          console.log(`[Import] Row ${i + 2}: No sprint specified (OK)`);
        }

        // Find assigned user if specified
        let assignedToId: string | null = null;
        if (row['Assigned to'] && row['Assigned to'].trim() !== '') {
          const emailOrName = row['Assigned to'].trim();
          console.log(`[Import] Row ${i + 2}: Looking for user '${emailOrName}'`);

          // Try to find by email first
          let user = await prisma.user.findUnique({
            where: {
              email: emailOrName,
            },
          });

          // If not found by email, try by name
          if (!user) {
            user = await prisma.user.findFirst({
              where: {
                name: {
                  contains: emailOrName,
                  mode: 'insensitive',
                },
              },
            });
          }

          if (!user || !user.isActive) {
            console.warn(`[Import] Row ${i + 2}: User '${emailOrName}' not found or inactive - importing without assignment`);
            assignedToId = null;
          } else {
            assignedToId = user.id;
            console.log(`[Import] Row ${i + 2}: Found user ID: ${assignedToId}`);
          }
        } else {
          console.log(`[Import] Row ${i + 2}: No user assignment (OK)`);
        }

        // Parse deadline - set to null if missing
        const deadline = row.Deadline && row.Deadline.trim() !== '' ? parseDate(row.Deadline) : null;

        // Build include object conditionally
        const includeClause: any = {
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        };

        // Only include assignedTo if user is assigned
        if (assignedToId) {
          includeClause.assignedTo = {
            select: {
              id: true,
              name: true,
              email: true,
            },
          };
        }

        // Only include sprint if task has a sprint
        if (sprintId) {
          includeClause.sprint = {
            select: {
              id: true,
              name: true,
            },
          };
        }

        // Check if parent task already exists in this import session
        let parentTask: any;
        let parentTaskId = taskMap.get(parentTaskName);

        if (parentTaskId) {
          // Parent task already created in a previous row, reuse it
          console.log(`[Import] Row ${i + 2}: Parent task '${parentTaskName}' already exists (ID: ${parentTaskId}), reusing it`);

          // Fetch the existing task
          parentTask = await prisma.task.findUnique({
            where: { id: parentTaskId },
            include: includeClause,
          });
        } else {
          // Check if task exists in database (from previous imports)
          const existingTask = await prisma.task.findFirst({
            where: {
              taskName: parentTaskName,
              sprintId: sprintId,
              nestingLevel: 0, // Only match root tasks
            },
          });

          if (existingTask) {
            console.log(`[Import] Row ${i + 2}: Parent task '${parentTaskName}' found in database (ID: ${existingTask.id}), reusing it`);
            parentTask = existingTask;
            parentTaskId = existingTask.id;
            taskMap.set(parentTaskName, parentTaskId);
          } else {
            // Create new parent task
            console.log(`[Import] Row ${i + 2}: Creating new parent task '${parentTaskName}'`);
            console.log(`[Import] Row ${i + 2}: Data being sent to Prisma:`, JSON.stringify({
              taskName: parentTaskName,
              details: row.Details ? row.Details.trim() : '',
              progress: row['Progress %'],
              nestingLevel: 0,
              parentTaskId: null,
              sprintId: sprintId,
              createdById: userId,
              assignedToId: assignedToId,
              startDate: null,
              deadline: deadline,
            }, null, 2));

            parentTask = await prisma.task.create({
              data: {
                taskName: parentTaskName,
                details: row.Details ? row.Details.trim() : '',
                progress: row['Progress %'],
                nestingLevel: 0,
                sprint: {
                  connect: { id: sprintId },
                },
                createdBy: {
                  connect: { id: userId },
                },
                ...(assignedToId && {
                  assignedTo: {
                    connect: { id: assignedToId },
                  },
                }),
                startDate: null,
                deadline: deadline,
              },
              include: includeClause,
            });

            console.log(`[Import] Row ${i + 2}: ✅ Parent task created - ID: ${parentTask.id}`);
            parentTaskId = parentTask.id;
            taskMap.set(parentTaskName, parentTaskId);

            importedTasks.push({
              id: parentTask.id,
              name: parentTask.taskName,
              progress: parentTask.progress,
              nestingLevel: parentTask.nestingLevel,
            });
          }
        }

        // Step 2: Create subtasks if the "Subtasks" column has values
        if (row.Subtasks && row.Subtasks.trim() !== '') {
          const subtaskNames = row.Subtasks.split(',').map((name: string) => name.trim()).filter((name: string) => name !== '');
          console.log(`[Import] Row ${i + 2}: Found ${subtaskNames.length} subtasks: ${subtaskNames.join(', ')}`);

          for (const subtaskName of subtaskNames) {
            try {
              console.log(`[Import] Row ${i + 2}: Creating subtask '${subtaskName}' under '${parentTaskName}'`);

              const subtask = await prisma.task.create({
                data: {
                  taskName: subtaskName,
                  details: '',
                  progress: 0,
                  nestingLevel: 1,
                  parentTask: {
                    connect: { id: parentTask.id },
                  },
                  sprint: {
                    connect: { id: sprintId },
                  },
                  createdBy: {
                    connect: { id: userId },
                  },
                  startDate: null,
                  deadline: null,
                },
              });

              console.log(`[Import] Row ${i + 2}: ✅ Subtask '${subtaskName}' created - ID: ${subtask.id}`);

              importedTasks.push({
                id: subtask.id,
                name: subtask.taskName,
                progress: subtask.progress,
                nestingLevel: subtask.nestingLevel,
              });
            } catch (subtaskError: any) {
              console.error(`[Import] Row ${i + 2}: ❌ Failed to create subtask '${subtaskName}':`, subtaskError.message);
              importErrors.push({
                row: i + 2,
                error: `Failed to create subtask '${subtaskName}': ${subtaskError.message}`,
              });
            }
          }
        }
      } catch (error: any) {
        console.error(`[Import] Row ${i + 2}: ❌ ERROR:`, error);
        console.error(`[Import] Row ${i + 2}: Full error details:`, JSON.stringify({
          message: error.message,
          code: error.code,
          meta: error.meta,
          stack: error.stack,
        }, null, 2));
        importErrors.push({
          row: i + 2,
          error: error.message,
        });
      }
    }

    console.log(`[Import] Task creation complete: ${importedTasks.length} tasks imported`);
    console.log(`[Audit] User ${userId} imported ${importedTasks.length} tasks from file ${file.filename}`);

    // Return results
    return {
      imported: importedTasks.length,
      skipped: importErrors.length,
      errors: importErrors.slice(0, 50), // Limit to first 50 errors
      tasks: importedTasks.slice(0, 100), // Return first 100 tasks
    };
  } finally {
    // Clean up uploaded file
    if (fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }
  }
}

/**
 * Get file by ID with authorization check
 */
export async function getFileById(fileId: string, userId: string) {
  const file = await prisma.file.findUnique({
    where: { id: fileId },
    include: {
      uploadedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      conversation: {
        include: {
          members: true,
        },
      },
    },
  });

  if (!file) {
    throw new Error('File not found');
  }

  // Check authorization
  const isOwner = file.uploadedById === userId;

  let isMember = false;
  if (file.conversationId && file.conversation) {
    isMember = file.conversation.members.some((m) => m.userId === userId);
  }

  // Check if user is admin
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  const isAdmin = user?.role === 'ADMIN';

  if (!isOwner && !isMember && !isAdmin) {
    throw new Error('You do not have permission to access this file');
  }

  return file;
}

/**
 * List files for a user
 */
export async function listFiles(
  userId: string,
  filters: { conversationId?: string },
  pagination: { page: number; limit: number }
) {
  const { conversationId } = filters;
  const { page, limit } = pagination;

  const skip = (page - 1) * limit;

  // Build where clause
  const where: Prisma.FileWhereInput = {
    OR: [
      { uploadedById: userId }, // User's own files
      {
        // Files in conversations user is a member of
        conversation: {
          members: {
            some: {
              userId,
            },
          },
        },
      },
    ],
    ...(conversationId && { conversationId }),
  };

  // Get files
  const [files, total] = await Promise.all([
    prisma.file.findMany({
      where,
      include: {
        uploadedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip,
      take: limit,
    }),
    prisma.file.count({ where }),
  ]);

  return {
    files: files.map((f) => ({
      id: f.id,
      filename: f.filename,
      mimeType: f.mimeType,
      size: f.size,
      url: `/api/upload/download/${f.id}`,
      uploadedBy: f.uploadedBy,
      conversationId: f.conversationId,
      createdAt: f.createdAt,
    })),
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit),
    },
  };
}

/**
 * Delete a file
 */
export async function deleteFile(fileId: string, userId: string) {
  const file = await prisma.file.findUnique({
    where: { id: fileId },
  });

  if (!file) {
    throw new Error('File not found');
  }

  // Check authorization: owner or admin
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  const isOwner = file.uploadedById === userId;
  const isAdmin = user?.role === 'ADMIN';

  if (!isOwner && !isAdmin) {
    throw new Error('You do not have permission to delete this file');
  }

  // Delete file from disk
  if (fs.existsSync(file.path)) {
    fs.unlinkSync(file.path);
  }

  // Delete from database
  await prisma.file.delete({
    where: { id: fileId },
  });

  console.log(`[Audit] User ${userId} deleted file ${fileId} (${file.filename})`);

  return {
    success: true,
    message: 'File deleted successfully',
  };
}
