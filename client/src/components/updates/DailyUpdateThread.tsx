/**
 * Daily Update Thread Component - Chat-style UI for daily updates
 */

import { useState, useEffect } from 'react';
import { useDayUpdates, useUserUpdateForDate, useCreateOrUpdateUpdate, DailyUpdate } from '@/hooks/useUpdates';
import { useCurrentUser } from '@/hooks/useUsers';
import { Send, Edit2, Check, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { connectSocket, on, off } from '@/lib/socket';

interface DailyUpdateThreadProps {
  date: string;
  onUpdatePosted?: () => void;
}

export default function DailyUpdateThread({ date, onUpdatePosted }: DailyUpdateThreadProps) {
  const [content, setContent] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const { data: currentUser } = useCurrentUser();
  const { data: updates, refetch: refetchUpdates } = useDayUpdates(date);
  const { data: userUpdate, refetch: refetchUserUpdate } = useUserUpdateForDate(date);
  const createOrUpdate = useCreateOrUpdateUpdate();

  const hasUserUpdate = !!userUpdate;
  const isToday = date === new Date().toISOString().split('T')[0];

  // Check if date is within allowed range (not future, not more than 30 days old)
  const selectedDateObj = new Date(date + 'T00:00:00');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const canSubmit = selectedDateObj >= thirtyDaysAgo && selectedDateObj <= today;

  useEffect(() => {
    connectSocket();

    // Listen for real-time updates
    on('daily_update_changed', (data: any) => {
      if (data.date && new Date(data.date).toISOString().split('T')[0] === date) {
        refetchUpdates();
        refetchUserUpdate();
      }
    });

    return () => {
      off('daily_update_changed');
    };
  }, [date, refetchUpdates, refetchUserUpdate]);

  // Initialize content when editing
  useEffect(() => {
    if (isEditing && userUpdate) {
      setContent(userUpdate.content);
    } else if (!isEditing) {
      setContent('');
    }
  }, [isEditing, userUpdate]);

  const handleSubmit = async () => {
    if (!content.trim() || !currentUser) return;

    try {
      await createOrUpdate.mutateAsync({ date, content: content.trim() });
      setContent('');
      setIsEditing(false);

      // Clear the exclamation mark indicator for this date
      if (onUpdatePosted) {
        onUpdatePosted();
      }
    } catch (error: any) {
      alert(error?.response?.data?.message || 'Failed to save update');
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
    setContent(userUpdate?.content || '');
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setContent('');
  };

  const formatTime = (dateStr: Date | string) => {
    return new Date(dateStr).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const formatDateHeader = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    return date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="flex h-full flex-col">
      {/* Updates List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {updates && updates.length > 0 ? (
          updates.map((update) => {
            const isOwnUpdate = update.userId === currentUser?.id;

            return (
              <div
                key={update.id}
                className={cn(
                  'flex gap-3 rounded-lg border border-border bg-card p-4',
                  isOwnUpdate && 'bg-primary/5'
                )}
              >
                {/* Avatar */}
                <div className="flex-shrink-0">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold">
                    {update.user.name.charAt(0).toUpperCase()}
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold">{update.user.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatTime(update.createdAt)}
                    </span>
                    {update.createdAt !== update.updatedAt && (
                      <span className="text-xs text-muted-foreground italic">(edited)</span>
                    )}
                  </div>
                  <p className="whitespace-pre-wrap text-sm">{update.content}</p>

                  {/* Edit button for own update */}
                  {isOwnUpdate && !isEditing && (
                    <button
                      onClick={handleEdit}
                      className="mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
                    >
                      <Edit2 className="h-3 w-3" />
                      Edit
                    </button>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="text-muted-foreground">No updates yet for this day</p>
          </div>
        )}
      </div>

      {/* Input Area */}
      {!canSubmit && (
        <div className="border-t border-border bg-card p-4">
          <div className="rounded-lg bg-muted border border-border px-4 py-3">
            <p className="text-sm text-muted-foreground">
              {selectedDateObj > today
                ? 'You cannot submit updates for future dates.'
                : 'This date is too far in the past. You can only submit updates for dates within the last 30 days.'}
            </p>
          </div>
        </div>
      )}
      {canSubmit && (
        <div className="border-t border-border bg-card p-4">
          {hasUserUpdate && !isEditing ? (
            <div className="flex items-center justify-between rounded-lg border border-border bg-muted/50 px-4 py-3">
              <span className="text-sm text-muted-foreground">
                You've already posted your update for this day
              </span>
              <button
                onClick={handleEdit}
                className="flex items-center gap-1 text-sm text-primary hover:underline"
              >
                <Edit2 className="h-4 w-4" />
                Edit
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {!isToday && (
                <div className="rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 px-3 py-2">
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    You're submitting an update for a past date. This will be marked as a late submission.
                  </p>
                </div>
              )}
              {isEditing && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Edit2 className="h-4 w-4" />
                  <span>Editing your update</span>
                </div>
              )}
              <div className="flex gap-2">
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Share your daily update..."
                  className="flex-1 min-h-[80px] rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  disabled={createOrUpdate.isPending}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {content.length} / 5000 characters
                </span>
                <div className="flex gap-2">
                  {isEditing && (
                    <button
                      onClick={handleCancelEdit}
                      disabled={createOrUpdate.isPending}
                      className="rounded-lg px-3 py-1.5 text-sm font-medium hover:bg-accent disabled:opacity-50"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={handleSubmit}
                    disabled={!content.trim() || createOrUpdate.isPending}
                    className="flex items-center gap-2 rounded-lg bg-primary px-4 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {createOrUpdate.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : isEditing ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                    {isEditing ? 'Update' : 'Post'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
