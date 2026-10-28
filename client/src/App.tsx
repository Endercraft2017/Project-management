/**
 * Main Application Component
 * Handles providers, authentication, real-time events, and the app shell
 */

import {
  QueryClient,
  QueryClientProvider,
  useQueryClient,
} from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { lazy, Suspense, useEffect, useState } from "react";
import { UserPlus } from "lucide-react";
import { useCurrentUser } from "@/hooks/useUsers";
import {
  initializeSocket,
  connectSocket,
  disconnectSocket,
  on,
  off,
} from "@/lib/socket";
import { markTaskSeen } from "@/lib/notification-storage";
import api from "@/lib/api";
import { playNotificationSound } from "@/lib/notificationSound";
import NotificationPanel from "@/components/chat/NotificationPanel";
import AmbientBackground from "@/components/layout/AmbientBackground";
import Sidebar from "@/components/layout/Sidebar";
import Topbar from "@/components/layout/Topbar";
import MobileDock from "@/components/layout/MobileDock";
import UserMenu from "@/components/layout/UserMenu";
import {
  LoadingScreen,
  SignInScreen,
  SessionUnavailableScreen,
  SessionChangedScreen,
} from "@/components/layout/AuthScreens";
import { getNavItem, type View } from "@/components/layout/navigation";
import { useActiveView } from "@/components/layout/useActiveView";
import { ToastProvider } from "@/contexts/ToastContext";
import { useUiStore } from "@/store/uiStore";
import {
  notificationKeys,
  type UnreadNotification,
} from "@/hooks/useNotifications";
import type { SocketEvents } from "@/types";

// Views and dialogs load on demand, so the first screen doesn't download
// charts, gantt, markdown/highlighting, and attachment previewers up front
const ProjectsPage = lazy(() => import("@/pages/ProjectsPage"));
const TaskTree = lazy(() => import("@/components/tasks/TaskTree"));
const SummaryView = lazy(() => import("@/components/summary/SummaryView"));
const GanttView = lazy(() => import("@/components/gantt/GanttView"));
const ChatView = lazy(() => import("@/components/chat/ChatView"));
const UpdatesView = lazy(() => import("@/components/updates/UpdatesView"));
const NotesView = lazy(() => import("@/components/notes/NotesView"));
const WeeklySummariesView = lazy(
  () => import("@/components/summaries/WeeklySummariesView"),
);
const UsersList = lazy(() => import("@/components/users/UsersList"));
const InvitesList = lazy(() => import("@/components/invites/InvitesList"));
const InviteUserDialog = lazy(
  () => import("@/components/invites/InviteUserDialog"),
);
const AdminSettingsModal = lazy(
  () => import("@/components/admin/AdminSettingsModal"),
);
const AcceptInvitePage = lazy(() => import("@/pages/AcceptInvitePage"));

function ViewLoading() {
  return (
    <div
      className="flex h-full min-h-48 items-center justify-center"
      role="status"
      aria-label="Loading"
    >
      <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-primary border-t-transparent" />
    </div>
  );
}

// Create a client with optimized defaults to reduce API calls
// Following TanStack Query 2025 best practices
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes - data stays fresh
      gcTime: 1000 * 60 * 10, // 10 minutes - cache persists longer (was cacheTime)
      refetchOnWindowFocus: false, // Rely on WebSocket for updates
      refetchOnMount: false, // Don't refetch on component mount if data exists
      refetchOnReconnect: false, // Rely on WebSocket reconnection logic
      retry: 1,
      // Enable structural sharing for render optimization
      structuralSharing: true,
    },
  },
});

function AppContent() {
  const {
    data: currentUser,
    isLoading,
    isError,
    error,
    refetch,
  } = useCurrentUser();
  const [sessionChanged, setSessionChanged] = useState(false);
  useEffect(() => {
    const changed = () => {
      disconnectSocket();
      setSessionChanged(true);
    };
    window.addEventListener("ez:workspace-session-changed", changed);
    return () =>
      window.removeEventListener("ez:workspace-session-changed", changed);
  }, []);
  const isAdmin = currentUser?.role === "ADMIN";
  const [activeView, setActiveView] = useActiveView(
    (view: View) => view !== "team" || isAdmin,
  );
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedConversationId, setSelectedConversationId] = useState<
    string | null
  >(null);
  const [highlightMessageId, setHighlightMessageId] = useState<string | null>(
    null,
  );
  const [missingUpdateDates, setMissingUpdateDates] = useState<string[]>([]);
  const [selectedUpdateDate, setSelectedUpdateDate] = useState<
    string | undefined
  >(undefined);
  const { sidebarCollapsed, toggleSidebar } = useUiStore();
  const queryClient = useQueryClient();

  // Initialize Socket.IO when user is authenticated
  useEffect(() => {
    if (currentUser) {
      initializeSocket();
      connectSocket();
    }
  }, [currentUser]);

  // Handle URL parameters for email links (e.g., /?view=updates&date=2025-10-27)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const viewParam = urlParams.get("view");
    const dateParam = urlParams.get("date");

    if (viewParam === "updates" && dateParam) {
      setSelectedUpdateDate(dateParam);
      // Clear URL parameters after processing, keeping the view in the hash
      window.history.replaceState(
        {},
        "",
        `${window.location.pathname}#/updates`,
      );
      setActiveView("updates");
    }
  }, [setActiveView]); // setActiveView is stable, so this runs once on mount

  // Listen for new messages globally to update notifications
  // Debounce invalidations to prevent rapid-fire API calls
  useEffect(() => {
    // Don't register listeners until user is authenticated and socket is initialized
    if (!currentUser) {
      return;
    }

    let notificationTimeout: ReturnType<typeof setTimeout> | null = null;
    let taskTimeout: ReturnType<typeof setTimeout> | null = null;

    const handleNewMessage = () => {
      // Play notification sound
      playNotificationSound();

      if (notificationTimeout) clearTimeout(notificationTimeout);
      notificationTimeout = setTimeout(() => {
        queryClient.refetchQueries({ queryKey: notificationKeys.list() });
        queryClient.refetchQueries({ queryKey: notificationKeys.count() });
      }, 300); // Debounce 300ms
    };

    const handleTaskEvent = () => {
      if (taskTimeout) clearTimeout(taskTimeout);
      taskTimeout = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["tasks"] });
      }, 500); // Debounce 500ms for task events
    };

    // Named so the same function references can be passed to off() on cleanup
    const handleTaskCreated = () => handleTaskEvent();
    const handleTaskUpdated = () => handleTaskEvent();
    const handleTaskDeleted = () => handleTaskEvent();

    const handleTaskAssigned = () => {
      // Play notification sound for task assignment
      playNotificationSound();

      if (notificationTimeout) clearTimeout(notificationTimeout);
      if (taskTimeout) clearTimeout(taskTimeout);

      notificationTimeout = setTimeout(() => {
        queryClient.refetchQueries({ queryKey: notificationKeys.list() });
        queryClient.refetchQueries({ queryKey: notificationKeys.count() });
      }, 300);

      taskTimeout = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["tasks"] });
      }, 500);
    };

    const handleTaskCreatedByMember = (
      data: Parameters<SocketEvents["task_created_by_member"]>[0],
    ) => {
      // Only notify admins
      if (currentUser?.role === "ADMIN" && data.adminId === currentUser.id) {
        playNotificationSound();

        if (notificationTimeout) clearTimeout(notificationTimeout);
        if (taskTimeout) clearTimeout(taskTimeout);

        notificationTimeout = setTimeout(() => {
          queryClient.refetchQueries({ queryKey: notificationKeys.list() });
          queryClient.refetchQueries({ queryKey: notificationKeys.count() });
        }, 300);

        taskTimeout = setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ["tasks"] });
        }, 500);
      }
    };

    const handleMemberDailyUpdate = () => {
      // Only notify admins
      if (currentUser?.role === "ADMIN") {
        playNotificationSound();
      }
    };

    const handleReminderNotification = (
      data: Parameters<SocketEvents["reminder_notification"]>[0],
    ) => {
      playNotificationSound();

      // Show browser notification if permitted
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification(`Reminder: ${data.noteTitle}`, {
          body: data.noteContent.substring(0, 100),
          icon: "/favicon.ico",
        });
      }
    };

    const handleUpdateReminder = (
      data: Parameters<SocketEvents["update_reminder"]>[0],
    ) => {
      playNotificationSound();

      // Refresh notification panel to show the new notification
      queryClient.invalidateQueries({ queryKey: notificationKeys.list() });
      queryClient.invalidateQueries({ queryKey: notificationKeys.count() });

      // Show browser notification if permitted (optional)
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification(data.title, {
          body: data.message,
          icon: "/favicon.ico",
        });
      }
    };

    on("new_message", handleNewMessage);
    on("task_created", handleTaskCreated);
    on("task_updated", handleTaskUpdated);
    on("task_deleted", handleTaskDeleted);
    on("task_assigned", handleTaskAssigned);
    on("task_created_by_member", handleTaskCreatedByMember);
    on("member_daily_update", handleMemberDailyUpdate);
    on("reminder_notification", handleReminderNotification);
    on("update_reminder", handleUpdateReminder);

    return () => {
      if (notificationTimeout) clearTimeout(notificationTimeout);
      if (taskTimeout) clearTimeout(taskTimeout);
      off("new_message", handleNewMessage);
      off("task_created", handleTaskCreated);
      off("task_updated", handleTaskUpdated);
      off("task_deleted", handleTaskDeleted);
      off("task_assigned", handleTaskAssigned);
      off("task_created_by_member", handleTaskCreatedByMember);
      off("member_daily_update", handleMemberDailyUpdate);
      off("reminder_notification", handleReminderNotification);
      off("update_reminder", handleUpdateReminder);
    };
  }, [queryClient, currentUser]);

  if (sessionChanged) return <SessionChangedScreen />;

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (isError && error) {
    const status = (error as { response?: { status?: number } }).response
      ?.status;
    if (status !== 401 && status !== 403)
      return (
        <SessionUnavailableScreen
          onRetry={() => {
            void refetch();
          }}
        />
      );
  }
  if (isError || !currentUser) {
    return <SignInScreen />;
  }

  const handleNotificationClick = async (notification: UnreadNotification) => {
    if (notification.type === "system") {
      setActiveView("notes");
      try {
        await api.put(
          `/api/conversations/notifications/${encodeURIComponent(notification.id)}/read`,
        );
        void queryClient.invalidateQueries({ queryKey: notificationKeys.all });
      } catch {
        /* Keep the notification unread if acknowledgement fails. */
      }
    } else if (notification.type === "update_reminder") {
      // Extract missing dates from notification metadata
      const missingDates = notification.metadata?.missingDates || [];
      setMissingUpdateDates(missingDates);

      // For update reminder notifications, navigate to updates
      setActiveView("updates");

      // Mark notification as read in database
      try {
        await api.put(
          `/api/conversations/notifications/${encodeURIComponent(notification.id)}/read`,
        );
      } catch (error) {
        console.error("Failed to mark notification as read:", error);
      }

      // Refresh notification list to remove it
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: notificationKeys.list() });
        queryClient.invalidateQueries({ queryKey: notificationKeys.count() });
      }, 100);
    } else if (notification.type === "task_assigned") {
      // For task notifications, switch to tasks view
      setActiveView("tasks");

      // Mark this task notification as seen in localStorage
      if (notification.taskId) markTaskSeen(currentUser, notification.taskId);

      // Invalidate queries to update the notification list
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: notificationKeys.list() });
        queryClient.invalidateQueries({ queryKey: notificationKeys.count() });
      }, 100);
    } else {
      // For message notifications, switch to chat
      setActiveView("chat");
      setSelectedConversationId(notification.conversationId);
      setHighlightMessageId(notification.messageId);
      setTimeout(() => setHighlightMessageId(null), 2000);
    }
  };

  return (
    <div className="flex h-[100dvh] gap-3 p-3">
      <AmbientBackground />

      <Sidebar
        activeView={activeView}
        onNavigate={setActiveView}
        isAdmin={isAdmin}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={toggleSidebar}
        mobileOpen={sidebarOpen}
        onMobileClose={() => setSidebarOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <Topbar
          current={getNavItem(activeView)}
          onOpenMenu={() => setSidebarOpen(true)}
          onInvite={isAdmin ? () => setInviteDialogOpen(true) : undefined}
          notifications={
            <NotificationPanel onNotificationClick={handleNotificationClick} />
          }
          userMenu={
            <UserMenu
              user={currentUser}
              onOpenSettings={
                isAdmin ? () => setSettingsDialogOpen(true) : undefined
              }
            />
          }
        />

        {/* Work surface. Glass sits on a sibling layer so fixed-position modals
            rendered inside views are not trapped by backdrop-filter. */}
        <main className="relative mb-[4.75rem] min-h-0 flex-1 overflow-hidden rounded-3xl lg:mb-0">
          <div
            aria-hidden
            className="glass-strong pointer-events-none absolute inset-0 rounded-3xl"
          />
          <div className="relative h-full overflow-y-auto">
            <Suspense fallback={<ViewLoading />}>
              {activeView === "dashboard" && (
                <div className="p-3 sm:p-6">
                  <SummaryView />
                </div>
              )}
              {activeView === "projects" && <ProjectsPage />}
              {activeView === "tasks" && (
                <div className="h-full p-3 sm:p-6">
                  <TaskTree />
                </div>
              )}
              {activeView === "gantt" && <GanttView />}
              {activeView === "chat" && (
                <ChatView
                  initialConversationId={selectedConversationId}
                  initialHighlightMessageId={highlightMessageId}
                  onConversationChange={setSelectedConversationId}
                />
              )}
              {activeView === "updates" && (
                <UpdatesView
                  highlightMissingDates={missingUpdateDates}
                  onClearHighlight={(date) => {
                    setMissingUpdateDates((prev) =>
                      prev.filter((d) => d !== date),
                    );
                  }}
                  initialDate={selectedUpdateDate}
                />
              )}
              {activeView === "summaries" && (
                <div className="h-full">
                  <WeeklySummariesView />
                </div>
              )}
              {activeView === "notes" && (
                <div className="h-full">
                  <NotesView />
                </div>
              )}
              {activeView === "team" && isAdmin && (
                <div className="space-y-8 p-3 sm:p-6">
                  <section className="space-y-4">
                    <div>
                      <h2 className="text-lg font-semibold">Team members</h2>
                      <p className="text-sm text-muted-foreground">
                        Active members in your team
                      </p>
                    </div>
                    <UsersList currentUserId={currentUser.id} />
                  </section>

                  <section className="space-y-4">
                    <div className="flex flex-wrap items-end justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-semibold">
                          Pending invitations
                        </h2>
                        <p className="text-sm text-muted-foreground">
                          Members who have been invited but haven't joined yet
                        </p>
                      </div>
                      <button
                        onClick={() => setInviteDialogOpen(true)}
                        className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:bg-primary/90"
                      >
                        <UserPlus className="h-4 w-4" />
                        Invite member
                      </button>
                    </div>
                    <InvitesList statusFilter="PENDING" />
                  </section>
                </div>
              )}
            </Suspense>
          </div>
        </main>
      </div>

      <MobileDock
        activeView={activeView}
        onNavigate={setActiveView}
        onOpenMenu={() => setSidebarOpen(true)}
      />

      {/* Dialogs mount on first open, which also loads their code on demand */}
      <Suspense fallback={null}>
        {inviteDialogOpen && (
          <InviteUserDialog
            open={inviteDialogOpen}
            onOpenChange={setInviteDialogOpen}
          />
        )}
        {settingsDialogOpen && (
          <AdminSettingsModal
            isOpen={settingsDialogOpen}
            onClose={() => setSettingsDialogOpen(false)}
          />
        )}
      </Suspense>
    </div>
  );
}

function AppRoot() {
  // An invite link (?token=...) shows the accept-invite page instead of the app
  const inviteToken = new URLSearchParams(window.location.search).get("token");
  if (inviteToken) {
    return (
      <Suspense fallback={<LoadingScreen />}>
        <AcceptInvitePage token={inviteToken} />
      </Suspense>
    );
  }
  return <AppContent />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AppRoot />
        {import.meta.env.DEV &&
          import.meta.env.VITE_QUERY_DEVTOOLS === "true" && (
            <ReactQueryDevtools initialIsOpen={false} />
          )}
      </ToastProvider>
    </QueryClientProvider>
  );
}
