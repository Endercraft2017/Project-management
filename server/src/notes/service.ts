/**
 * Notes Service
 * Business logic for personal notes and reminders
 */

import prisma from '@/database/client';
import type { CreateNoteInput, UpdateNoteInput, AddReminderInput, UpdateReminderInput } from './validators';

/**
 * Create a new note for a user
 */
export async function createNote(userId: string, data: CreateNoteInput) {
  return await prisma.note.create({
    data: {
      title: data.title,
      content: data.content,
      tags: data.tags || [],
      isPinned: data.isPinned || false,
      user: {
        connect: {
          id: userId,
        },
      },
    },
    include: {
      reminders: {
        where: {
          isCompleted: false,
        },
        orderBy: {
          remindAt: 'asc',
        },
      },
    },
  });
}

/**
 * Get all notes for a user
 */
export async function getUserNotes(
  userId: string,
  options: {
    search?: string;
    tag?: string;
    pinned?: boolean;
    limit?: number;
    offset?: number;
  } = {}
) {
  const { search, tag, pinned, limit = 50, offset = 0 } = options;

  const where: any = {
    userId,
  };

  // Filter by pinned status
  if (pinned !== undefined) {
    where.isPinned = pinned;
  }

  // Filter by tag
  if (tag) {
    where.tags = {
      has: tag,
    };
  }

  // Search in title and content
  if (search) {
    where.OR = [
      {
        title: {
          contains: search,
          mode: 'insensitive',
        },
      },
      {
        content: {
          contains: search,
          mode: 'insensitive',
        },
      },
    ];
  }

  const [notes, total] = await Promise.all([
    prisma.note.findMany({
      where,
      include: {
        reminders: {
          where: {
            isCompleted: false,
          },
          orderBy: {
            remindAt: 'asc',
          },
        },
      },
      orderBy: [
        {
          isPinned: 'desc',
        },
        {
          updatedAt: 'desc',
        },
      ],
      take: limit,
      skip: offset,
    }),
    prisma.note.count({ where }),
  ]);

  return {
    notes,
    total,
    limit,
    offset,
  };
}

/**
 * Get a single note by ID (must belong to user)
 */
export async function getNoteById(noteId: string, userId: string) {
  const note = await prisma.note.findUnique({
    where: {
      id: noteId,
    },
    include: {
      reminders: {
        orderBy: {
          remindAt: 'asc',
        },
      },
    },
  });

  // Ensure note belongs to user
  if (!note || note.userId !== userId) {
    throw new Error('Note not found or access denied');
  }

  return note;
}

/**
 * Update a note
 */
export async function updateNote(
  noteId: string,
  userId: string,
  data: UpdateNoteInput
) {
  // Verify ownership
  const existing = await prisma.note.findUnique({
    where: { id: noteId },
    select: { userId: true },
  });

  if (!existing || existing.userId !== userId) {
    throw new Error('Note not found or access denied');
  }

  return await prisma.note.update({
    where: {
      id: noteId,
    },
    data,
    include: {
      reminders: {
        where: {
          isCompleted: false,
        },
        orderBy: {
          remindAt: 'asc',
        },
      },
    },
  });
}

/**
 * Delete a note
 */
export async function deleteNote(noteId: string, userId: string) {
  // Verify ownership
  const existing = await prisma.note.findUnique({
    where: { id: noteId },
    select: { userId: true },
  });

  if (!existing || existing.userId !== userId) {
    throw new Error('Note not found or access denied');
  }

  await prisma.note.delete({
    where: {
      id: noteId,
    },
  });

  return { success: true };
}

/**
 * Add a reminder to a note
 */
export async function addReminder(userId: string, data: AddReminderInput) {
  // Verify note ownership
  const note = await prisma.note.findUnique({
    where: { id: data.noteId },
    select: { userId: true },
  });

  if (!note || note.userId !== userId) {
    throw new Error('Note not found or access denied');
  }

  const remindAt = new Date(data.remindAt);

  // Ensure reminder is in the future
  if (remindAt <= new Date()) {
    throw new Error('Reminder must be set for a future time');
  }

  return await prisma.reminder.create({
    data: {
      noteId: data.noteId,
      remindAt,
    },
  });
}

/**
 * Update a reminder
 */
export async function updateReminder(
  reminderId: string,
  userId: string,
  data: UpdateReminderInput
) {
  // Verify ownership through note
  const reminder = await prisma.reminder.findUnique({
    where: { id: reminderId },
    include: {
      note: {
        select: { userId: true },
      },
    },
  });

  if (!reminder || reminder.note.userId !== userId) {
    throw new Error('Reminder not found or access denied');
  }

  const updateData: any = {};

  if (data.remindAt) {
    const remindAt = new Date(data.remindAt);
    if (remindAt <= new Date() && !data.isCompleted) {
      throw new Error('Reminder must be set for a future time');
    }
    updateData.remindAt = remindAt;
  }

  if (data.isCompleted !== undefined) {
    updateData.isCompleted = data.isCompleted;
  }

  return await prisma.reminder.update({
    where: { id: reminderId },
    data: updateData,
  });
}

/**
 * Delete a reminder
 */
export async function deleteReminder(reminderId: string, userId: string) {
  // Verify ownership through note
  const reminder = await prisma.reminder.findUnique({
    where: { id: reminderId },
    include: {
      note: {
        select: { userId: true },
      },
    },
  });

  if (!reminder || reminder.note.userId !== userId) {
    throw new Error('Reminder not found or access denied');
  }

  await prisma.reminder.delete({
    where: { id: reminderId },
  });

  return { success: true };
}

/**
 * Get due reminders (for notification system)
 */
export async function getDueReminders() {
  return await prisma.reminder.findMany({
    where: {
      isCompleted: false,
      notifiedAt: null,
      remindAt: {
        lte: new Date(),
      },
    },
    include: {
      note: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      },
    },
  });
}

/**
 * Mark reminder as notified
 */
export async function markReminderNotified(reminderId: string) {
  return await prisma.reminder.update({
    where: { id: reminderId },
    data: {
      notifiedAt: new Date(),
    },
  });
}
