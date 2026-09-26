/**
 * Missing Updates Modal
 * Displays users who have missing daily updates
 * Allows admins to send reminder notifications
 */

import { useState, useMemo } from 'react';
import { useMissingUpdates, useSendUpdateReminder } from '@/hooks/useMissingUpdates';
import { useToast } from '@/hooks/useToast';
import { Send, Calendar, Users, Loader2, AlertCircle, X } from 'lucide-react';
import type { MissingUpdate } from '@/types';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function MissingUpdatesModal({ isOpen, onClose }: Props) {
  const { toast } = useToast();
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [sendingTo, setSendingTo] = useState<string | null>(null);

  // Fetch missing updates
  const { data, isLoading, error, refetch } = useMissingUpdates(
    customStartDate || undefined,
    customEndDate || undefined,
    isOpen
  );

  // Send reminder mutation
  const sendReminder = useSendUpdateReminder();

  // Handle sending reminder
  const handleSendReminder = async (user: MissingUpdate) => {
    console.log('[MissingUpdatesModal] Sending reminder to:', user.userId, user.userName);
    console.log('[MissingUpdatesModal] Missing dates:', user.missingDates);

    setSendingTo(user.userId);
    try {
      const result = await sendReminder.mutateAsync({
        userId: user.userId,
        missingDates: user.missingDates,
      });

      console.log('[MissingUpdatesModal] Reminder sent successfully:', result);

      toast({
        title: 'Reminder Sent',
        description: `Notification sent to ${user.userName}`,
        variant: 'success',
      });
    } catch (error: unknown) {
      console.error('[MissingUpdatesModal] Failed to send reminder:', error);

      toast({
        title: 'Error',
        description: `Failed to send reminder: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: 'error',
      });
    } finally {
      setSendingTo(null);
    }
  };

  // Format date for display
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // Sort users by number of missing days (descending)
  const sortedUsers = useMemo(() => {
    if (!data?.users) return [];
    return [...data.users].sort((a, b) => b.missingDates.length - a.missingDates.length);
  }, [data?.users]);

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
        <div className="bg-card border border-border rounded-lg shadow-lg max-w-4xl w-full max-h-[80vh] overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-500" />
              Missing Daily Updates
            </h2>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground rounded-md p-2"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            {/* Date Range Filter */}
            <div className="space-y-4 border-b pb-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="start-date" className="block text-sm font-medium mb-2">
                    Start Date
                  </label>
                  <input
                    id="start-date"
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="end-date" className="block text-sm font-medium mb-2">
                    End Date
                  </label>
                  <input
                    id="end-date"
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  />
                </div>
              </div>
              {(customStartDate || customEndDate) && (
                <button
                  onClick={() => {
                    setCustomStartDate('');
                    setCustomEndDate('');
                  }}
                  className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm font-medium hover:bg-accent"
                >
                  Reset to Default
                </button>
              )}
            </div>

            {/* Summary Statistics */}
            {data && (
              <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-blue-500" />
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Date Range</p>
                    <p className="font-semibold">
                      {formatDate(data.dateRange.startDate)} - {formatDate(data.dateRange.endDate)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-orange-500" />
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Users Missing Updates</p>
                    <p className="font-semibold">{data.totalUsers}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-red-500" />
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Total Missing Days</p>
                    <p className="font-semibold">{data.totalMissingDays}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Loading State */}
            {isLoading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
              </div>
            )}

            {/* Error State */}
            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <p className="text-sm text-red-600 dark:text-red-400">
                  Failed to load missing updates. Please try again.
                </p>
              </div>
            )}

            {/* User List */}
            {data && data.users.length === 0 && (
              <div className="text-center py-12">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/20 mb-4">
                  <svg
                    className="w-8 h-8 text-green-600 dark:text-green-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold mb-1">All Caught Up!</h3>
                <p className="text-gray-600 dark:text-gray-400">
                  No users have missing updates for the selected date range.
                </p>
              </div>
            )}

            {sortedUsers.length > 0 && (
              <div className="space-y-2">
                {sortedUsers.map((user) => (
                  <div
                    key={user.userId}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                  >
                    <div className="flex-1">
                      <h4 className="font-semibold">{user.userName}</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{user.userEmail}</p>
                      <div className="mt-2">
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                          Missing dates ({user.missingDates.length}):
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {user.missingDates.map((date) => (
                            <span
                              key={date}
                              className="inline-block px-2 py-1 text-xs bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 rounded"
                            >
                              {formatDate(date)}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleSendReminder(user)}
                      disabled={sendingTo === user.userId}
                      className="ml-4 inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-accent disabled:opacity-50"
                    >
                      {sendingTo === user.userId ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4" />
                          Send Reminder
                        </>
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-between p-6 border-t">
            <button
              onClick={() => refetch()}
              className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium hover:bg-accent"
            >
              Refresh
            </button>
            <button
              onClick={onClose}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
