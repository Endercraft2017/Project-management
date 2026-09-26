/**
 * Notes View Component
 * Personal markdown notes with reminders
 */

import { useState } from 'react';
import { Plus, Search, X, Pin, Tag, Calendar, Trash2, Edit3, Save, Bell } from 'lucide-react';
import { useNotes, useCreateNote, useUpdateNote, useDeleteNote, useAddReminder, useDeleteReminder, type Note, type CreateNoteInput } from '@/hooks/useNotes';
import ReactMarkdown from 'react-markdown';

export default function NotesView() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | undefined>();
  const [showPinnedOnly, setShowPinnedOnly] = useState(false);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [editForm, setEditForm] = useState({ title: '', content: '', tags: '', isPinned: false });
  const [reminderDate, setReminderDate] = useState('');

  const { data, isLoading } = useNotes({
    search: searchQuery || undefined,
    tag: selectedTag,
    pinned: showPinnedOnly || undefined,
  });

  const createNote = useCreateNote();
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();
  const addReminder = useAddReminder();
  const deleteReminder = useDeleteReminder();

  const notes = data?.notes || [];
  const allTags = Array.from(new Set(notes.flatMap((n: Note) => n.tags)));

  const handleCreate = () => {
    const noteData: CreateNoteInput = {
      title: editForm.title,
      content: editForm.content,
      tags: editForm.tags.split(',').map(t => t.trim()).filter(Boolean),
      isPinned: editForm.isPinned,
    };

    createNote.mutate(noteData, {
      onSuccess: (newNote) => {
        setIsCreating(false);
        setEditForm({ title: '', content: '', tags: '', isPinned: false });
        setSelectedNote(newNote);
      },
    });
  };

  const handleUpdate = () => {
    if (!selectedNote) return;

    updateNote.mutate({
      id: selectedNote.id,
      data: {
        title: editForm.title,
        content: editForm.content,
        tags: editForm.tags.split(',').map(t => t.trim()).filter(Boolean),
        isPinned: editForm.isPinned,
      },
    }, {
      onSuccess: (updated) => {
        setIsEditing(false);
        setSelectedNote(updated);
      },
    });
  };

  const handleDelete = (id: string) => {
    if (confirm('Delete this note?')) {
      deleteNote.mutate(id, {
        onSuccess: () => {
          setSelectedNote(null);
        },
      });
    }
  };

  const handleAddReminder = () => {
    if (!selectedNote || !reminderDate) return;

    addReminder.mutate({
      noteId: selectedNote.id,
      remindAt: reminderDate,
    }, {
      onSuccess: () => {
        setReminderDate('');
      },
    });
  };

  const startEdit = (note: Note) => {
    setEditForm({
      title: note.title,
      content: note.content,
      tags: note.tags.join(', '),
      isPinned: note.isPinned,
    });
    setIsEditing(true);
  };

  const startCreate = () => {
    setEditForm({ title: '', content: '', tags: '', isPinned: false });
    setIsCreating(true);
    setSelectedNote(null);
    setIsEditing(false);
  };

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="w-80 border-r border-border bg-card flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Notes</h2>
            <button
              onClick={startCreate}
              className="rounded-lg bg-primary p-2 text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-input bg-background pl-10 pr-8 py-2 text-sm"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Filters */}
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => setShowPinnedOnly(!showPinnedOnly)}
              className={`flex items-center gap-1 rounded px-2 py-1 text-xs ${showPinnedOnly ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}
            >
              <Pin className="h-3 w-3" />
              Pinned
            </button>
            {selectedTag && (
              <button
                onClick={() => setSelectedTag(undefined)}
                className="flex items-center gap-1 rounded px-2 py-1 text-xs bg-primary text-primary-foreground"
              >
                <Tag className="h-3 w-3" />
                {selectedTag}
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Tags */}
          {allTags.length > 0 && !selectedTag && (
            <div className="flex flex-wrap gap-1 mt-2">
              {allTags.slice(0, 5).map((tag: string) => (
                <button
                  key={tag}
                  onClick={() => setSelectedTag(tag)}
                  className="rounded px-2 py-1 text-xs bg-muted hover:bg-accent"
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Notes List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 text-center text-muted-foreground">Loading...</div>
          ) : notes.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">No notes found</div>
          ) : (
            notes.map((note: Note) => (
              <button
                key={note.id}
                onClick={() => {
                  setSelectedNote(note);
                  setIsCreating(false);
                  setIsEditing(false);
                }}
                className={`w-full text-left p-3 border-b border-border hover:bg-accent transition-colors ${
                  selectedNote?.id === note.id ? 'bg-accent' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {note.isPinned && <Pin className="h-3 w-3 text-primary flex-shrink-0" />}
                      <h3 className="font-medium truncate">{note.title}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground truncate mt-1">
                      {note.content.substring(0, 60)}...
                    </p>
                    {note.tags.length > 0 && (
                      <div className="flex gap-1 mt-1">
                        {note.tags.slice(0, 2).map((tag) => (
                          <span key={tag} className="text-xs bg-muted px-1.5 py-0.5 rounded">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {note.reminders.length > 0 && (
                    <Bell className="h-3 w-3 text-primary flex-shrink-0" />
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {isCreating || (isEditing && selectedNote) ? (
          /* Edit/Create Form */
          <div className="flex-1 flex flex-col p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">{isCreating ? 'New Note' : 'Edit Note'}</h2>
              <div className="flex gap-2">
                <button
                  onClick={() => { setIsCreating(false); setIsEditing(false); }}
                  className="rounded-lg border border-input bg-background px-4 py-2 hover:bg-accent"
                >
                  Cancel
                </button>
                <button
                  onClick={isCreating ? handleCreate : handleUpdate}
                  disabled={!editForm.title || !editForm.content}
                  className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  Save
                </button>
              </div>
            </div>

            <input
              type="text"
              placeholder="Note title"
              value={editForm.title}
              onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
              className="w-full rounded-lg border border-input bg-background px-4 py-2 text-lg font-semibold mb-3"
            />

            <textarea
              placeholder="Write your note in markdown..."
              value={editForm.content}
              onChange={(e) => setEditForm({ ...editForm, content: e.target.value })}
              className="flex-1 w-full rounded-lg border border-input bg-background px-4 py-3 font-mono text-sm resize-none mb-3"
            />

            <div className="flex gap-3">
              <input
                type="text"
                placeholder="Tags (comma separated)"
                value={editForm.tags}
                onChange={(e) => setEditForm({ ...editForm, tags: e.target.value })}
                className="flex-1 rounded-lg border border-input bg-background px-4 py-2 text-sm"
              />
              <label className="flex items-center gap-2 rounded-lg border border-input bg-background px-4 py-2">
                <input
                  type="checkbox"
                  checked={editForm.isPinned}
                  onChange={(e) => setEditForm({ ...editForm, isPinned: e.target.checked })}
                  className="rounded"
                />
                <Pin className="h-4 w-4" />
                Pin
              </label>
            </div>
          </div>
        ) : selectedNote ? (
          /* View Note */
          <div className="flex-1 flex flex-col">
            {/* Note Header */}
            <div className="border-b border-border bg-card px-6 py-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {selectedNote.isPinned && <Pin className="h-4 w-4 text-primary" />}
                    <h1 className="text-2xl font-bold">{selectedNote.title}</h1>
                  </div>
                  {selectedNote.tags.length > 0 && (
                    <div className="flex gap-2">
                      {selectedNote.tags.map((tag) => (
                        <span key={tag} className="text-sm bg-muted px-2 py-1 rounded">
                          <Tag className="h-3 w-3 inline mr-1" />
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => startEdit(selectedNote)}
                    className="rounded-lg border border-input bg-background p-2 hover:bg-accent"
                  >
                    <Edit3 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(selectedNote.id)}
                    className="rounded-lg border border-input bg-background p-2 hover:bg-destructive hover:text-destructive-foreground"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Note Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <ReactMarkdown>{selectedNote.content}</ReactMarkdown>
              </div>
            </div>

            {/* Reminders */}
            <div className="border-t border-border bg-card p-4">
              <h3 className="font-semibold mb-3 flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Reminders
              </h3>
              {selectedNote.reminders.filter(r => !r.isCompleted).map((reminder) => (
                <div key={reminder.id} className="flex items-center justify-between bg-muted rounded p-2 mb-2">
                  <span className="text-sm">
                    {new Date(reminder.remindAt).toLocaleString()}
                  </span>
                  <button
                    onClick={() => deleteReminder.mutate({ reminderId: reminder.id, noteId: selectedNote.id })}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <div className="flex gap-2 mt-2">
                <input
                  type="datetime-local"
                  value={reminderDate}
                  onChange={(e) => setReminderDate(e.target.value)}
                  className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm"
                />
                <button
                  onClick={handleAddReminder}
                  disabled={!reminderDate}
                  className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Empty State */
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <Edit3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Select a note or create a new one</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
