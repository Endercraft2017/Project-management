/**
 * React Query hooks for Notes API
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface Note {
  id: string;
  title: string;
  content: string;
  tags: string[];
  isPinned: boolean;
  userId: string;
  createdAt: string;
  updatedAt: string;
  reminders: Reminder[];
}

export interface Reminder {
  id: string;
  noteId: string;
  remindAt: string;
  isCompleted: boolean;
  notifiedAt: string | null;
  createdAt: string;
}

export interface CreateNoteInput {
  title: string;
  content: string;
  tags?: string[];
  isPinned?: boolean;
}

export interface UpdateNoteInput {
  title?: string;
  content?: string;
  tags?: string[];
  isPinned?: boolean;
}

export interface AddReminderInput {
  noteId: string;
  remindAt: string;
}

// Query keys
export const noteKeys = {
  all: ['notes'] as const,
  lists: () => [...noteKeys.all, 'list'] as const,
  list: (filters?: any) => [...noteKeys.lists(), filters] as const,
  details: () => [...noteKeys.all, 'detail'] as const,
  detail: (id: string) => [...noteKeys.details(), id] as const,
};

/**
 * Get all notes with optional filters
 */
export function useNotes(options?: {
  search?: string;
  tag?: string;
  pinned?: boolean;
}) {
  return useQuery({
    queryKey: noteKeys.list(options),
    queryFn: async () => {
      const params = new URLSearchParams();
      if (options?.search) params.append('search', options.search);
      if (options?.tag) params.append('tag', options.tag);
      if (options?.pinned !== undefined) params.append('pinned', String(options.pinned));

      const response = await api.get(`/api/notes?${params.toString()}`);
      return response.data.data;
    },
    staleTime: 30000, // 30 seconds
  });
}

/**
 * Get a single note by ID
 */
export function useNote(noteId: string) {
  return useQuery({
    queryKey: noteKeys.detail(noteId),
    queryFn: async () => {
      const response = await api.get(`/api/notes/${noteId}`);
      return response.data.data as Note;
    },
    enabled: !!noteId,
    staleTime: 30000,
  });
}

/**
 * Create a new note
 */
export function useCreateNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateNoteInput) => {
      const response = await api.post('/api/notes', data);
      return response.data.data as Note;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: noteKeys.lists() });
    },
  });
}

/**
 * Update a note
 */
export function useUpdateNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: UpdateNoteInput }) => {
      const response = await api.patch(`/api/notes/${id}`, data);
      return response.data.data as Note;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: noteKeys.lists() });
      queryClient.invalidateQueries({ queryKey: noteKeys.detail(data.id) });
    },
  });
}

/**
 * Delete a note
 */
export function useDeleteNote() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/api/notes/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: noteKeys.lists() });
    },
  });
}

/**
 * Add a reminder to a note
 */
export function useAddReminder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: AddReminderInput) => {
      const response = await api.post('/api/notes/reminders', data);
      return response.data.data as Reminder;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: noteKeys.detail(variables.noteId) });
      queryClient.invalidateQueries({ queryKey: noteKeys.lists() });
    },
  });
}

/**
 * Delete a reminder
 */
export function useDeleteReminder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ reminderId, noteId }: { reminderId: string; noteId: string }) => {
      await api.delete(`/api/notes/reminders/${reminderId}`);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: noteKeys.detail(variables.noteId) });
      queryClient.invalidateQueries({ queryKey: noteKeys.lists() });
    },
  });
}
