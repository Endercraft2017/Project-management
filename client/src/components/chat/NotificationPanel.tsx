/**
 * Notification Panel Component
 * Shows all unread messages across conversations in a dropdown
 */

import { useState, useRef, useEffect } from 'react';
import { Bell, X, CheckSquare } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { useNotifications, notificationKeys, type UnreadNotification } from '@/hooks/useNotifications';
import { formatDate } from '@/lib/utils';

interface NotificationPanelProps {
  onNotificationClick: (notification: UnreadNotification) => void;
}

export default function NotificationPanel({ onNotificationClick }: NotificationPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch } = useNotifications(50);

  const notifications = data?.notifications || [];
  const unreadCount = data?.count || 0;

  // Close panel when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleNotificationClick = (notification: UnreadNotification) => {
    onNotificationClick(notification);
    setIsOpen(false);

    // Invalidate notifications after clicking to update the list
    setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.list() });
      queryClient.invalidateQueries({ queryKey: notificationKeys.count() });
    }, 500); // Small delay to allow backend to process conversation join
  };

  const truncateMessage = (content: string, maxLength: number = 60) => {
    if (content.length <= maxLength) return content;
    return content.substring(0, maxLength) + '...';
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell Icon Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative rounded-full p-2.5 text-foreground/80 transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
        title="Notifications"
        aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : 'Notifications'}
        aria-expanded={isOpen}
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground shadow-md ring-2 ring-white/70 dark:ring-black/40">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel - Mobile Responsive */}
      {isOpen && (
        <div className="fixed inset-x-3 top-[5.25rem] z-50 flex max-h-[calc(100dvh-11rem)] flex-col overflow-hidden rounded-3xl border border-border bg-popover/95 shadow-2xl backdrop-blur-xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:mt-3 sm:max-h-[600px] sm:w-96">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <h3 className="text-base font-semibold">Notifications</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="rounded-full p-1.5 transition-colors hover:bg-foreground/[0.06]"
              aria-label="Close notifications"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Notifications List */}
          <div className="flex-1 overflow-y-auto">
            {isError && (
              <div role="alert" className="border-b border-border p-4 text-sm">
                <p>Notifications could not refresh.</p>
                <button type="button" onClick={() => { void refetch(); }} className="mt-2 rounded border border-border px-3 py-2 hover:bg-accent">Try again</button>
              </div>
            )}
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-sm text-muted-foreground">Loading...</div>
              </div>
            ) : notifications.length === 0 && !isError ? (
              <div className="flex flex-col items-center justify-center py-12 px-4">
                <Bell className="h-12 w-12 text-muted-foreground/50 mb-3" />
                <p className="text-sm text-muted-foreground text-center">
                  No new notifications
                </p>
              </div>
            ) : (
              <div>
                {notifications.map((notification) => (
                  <button
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className="w-full text-left border-b border-border p-4 hover:bg-accent transition-colors"
                  >
                    {notification.type === 'update_reminder' || notification.type === 'system' ? (
                      /* Update Reminder Notification */
                      <div className="flex items-start gap-3">
                        <div className="h-10 w-10 rounded-full bg-orange-500/10 flex items-center justify-center flex-shrink-0">
                          <Bell className="h-5 w-5 text-orange-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm mb-1">
                            {notification.title}
                          </div>
                          <p className="text-sm text-muted-foreground mb-1">
                            {notification.message}
                          </p>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(notification.createdAt)}
                          </span>
                        </div>
                      </div>
                    ) : notification.type === 'task_assigned' ? (
                      /* Task Assignment Notification */
                      <div className="flex items-start gap-3">
                        <div className="h-10 w-10 rounded-full bg-blue-500/10 flex items-center justify-center flex-shrink-0">
                          <CheckSquare className="h-5 w-5 text-blue-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-sm truncate">
                              {notification.assignedByName}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              assigned you a task
                            </span>
                          </div>
                          <p className="text-sm text-foreground font-medium truncate mb-1">
                            {notification.taskName}
                          </p>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(notification.createdAt)}
                          </span>
                        </div>
                      </div>
                    ) : (
                      /* Message Notification */
                      <div className="flex items-start gap-3">
                        {notification.senderPicture ? (
                          <img
                            src={notification.senderPicture}
                            alt={notification.senderName || 'User'}
                            className="h-10 w-10 rounded-full flex-shrink-0"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <span className="text-sm font-medium text-primary">
                              {notification.senderName?.charAt(0).toUpperCase() || '?'}
                            </span>
                          </div>
                        )}

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-sm truncate">
                              {notification.senderName}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              in
                            </span>
                            <span className="text-xs text-muted-foreground truncate">
                              {notification.conversationName}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground truncate mb-1">
                            {truncateMessage(notification.messageContent || '')}
                          </p>
                          <div className="flex items-center gap-2">
                            {notification.isThreadReply && (
                              <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                                Thread Reply
                              </span>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {formatDate(notification.createdAt)}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
