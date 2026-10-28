import type { DailyUpdate } from '@/hooks/useUpdates';
/**
 * Core Type Definitions for ServiceBay PM Frontend
 */

export type Role = 'ADMIN' | 'MEMBER';

export type SprintStatus = 'PLANNED' | 'ACTIVE' | 'COMPLETED';

export interface User {
  id: string;
  tenant?: { id: string; code: string; name: string };
  email: string;
  name: string;
  picture?: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Sprint {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: SprintStatus;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: User;
  tasks?: Task[];
  _count?: {
    tasks: number;
  };
}

export interface Task {
  id: string;
  taskName: string;
  sprintId?: string;
  sprintName?: string;
  parentTaskId?: string;
  details?: string;
  progress: number;
  assignedToId: string;
  startDate: string;
  deadline: string;
  nestingLevel: number;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  sprint?: Sprint;
  assignedTo?: User;
  createdBy?: User;
  parentTask?: Task;
  subtasks?: Task[];
  _count?: {
    subtasks: number;
  };
}

export type ConversationType = 'DM' | 'GROUP';

export interface Conversation {
  id: string;
  type: ConversationType;
  name?: string;
  description?: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  members?: ConversationMember[];
  messages?: Message[];
  _count?: {
    members: number;
    messages: number;
  };
}

export interface ConversationMember {
  id: string;
  conversationId: string;
  userId: string;
  isAdmin: boolean;
  joinedAt: string;
  user?: User;
}

export interface MessageAttachment {
  id: string;
  driveFileId: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  thumbnailLink?: string;
  webViewLink: string;
  webContentLink?: string;
  iconLink?: string;
  createdAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  attachments?: MessageAttachment[];
  reactions?: Record<string, string[]>;

  // Threading support
  parentMessageId?: string;
  threadRepliesCount: number;

  isEdited: boolean;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
  sender?: User;
}

export interface SyncLog {
  id: string;
  spreadsheetId: string;
  sheetName: string;
  syncType: 'export' | 'import' | 'bidirectional';
  recordsExported: number;
  recordsImported: number;
  recordsUpdated: number;
  recordsSkipped: number;
  conflicts: number;
  status: 'completed' | 'failed' | 'partial';
  error?: string;
  duration: number;
  performedById: string;
  createdAt: string;
  performedBy?: User;
}

export interface File {
  id: string;
  filename: string;
  storedFilename: string;
  mimeType: string;
  size: number;
  path: string;
  uploadedById: string;
  conversationId?: string;
  messageId?: string;
  createdAt: string;
  uploadedBy?: User;
}

// API Response Types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// Form Types
export interface CreateTaskInput {
  taskName: string;
  sprintId?: string;
  sprintName?: string;
  parentTaskId?: string;
  details?: string;
  progress?: number;
  assignedToId: string;
  startDate: string;
  deadline: string;
}

export interface UpdateTaskInput {
  parentTaskId?: string | null;
  sprintName?: string;
  taskName?: string;
  sprintId?: string;
  details?: string;
  progress?: number;
  assignedToId?: string;
  startDate?: string;
  deadline?: string;
}

export interface CreateSprintInput {
  name: string;
  startDate: string;
  endDate: string;
}

export interface UpdateSprintInput {
  name?: string;
  startDate?: string;
  endDate?: string;
  status?: SprintStatus;
}

// Filter Types
export interface TaskFilters {
  search?: string;
  sprintId?: string;
  assignedToId?: string;
  createdById?: string;
  nestingLevel?: number;
  minProgress?: number;
  maxProgress?: number;
  limit?: number;
}

export interface SprintFilters {
  status?: SprintStatus;
  search?: string;
  includeStats?: boolean;
}

// Invitation Types
export type InviteStatus = 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED';

export interface TeamInvite {
  id: string;
  email: string;
  setupUrl?: string; // One-use activation URL returned only on creation
  role: Role;
  status: InviteStatus;
  invitedBy: {
    name: string;
    email: string;
  };
  expiresAt: string;
  acceptedAt?: string;
  createdAt: string;
}

export interface SendInviteInput {
  email: string;
  role: Role;
}

export interface AcceptInviteInput {
  token: string;
  name: string;
  googleId?: string;
  picture?: string;
}

export interface InviteFilters {
  status?: InviteStatus;
  email?: string;
}

export interface ValidateInviteResponse {
  email: string;
  role: Role;
  status: InviteStatus;
  invitedBy: string;
  expiresAt: string;
  isValid: boolean;
}

// Socket Event Types
export interface SocketEvents {
  // Client to Server
  join_conversation: (data: { conversationId: string }) => void;
  leave_conversation: (data: { conversationId: string }) => void;
  send_message: (data: {
    conversationId: string;
    content: string;
    driveFileIds?: string[];
  }) => void;
  edit_message: (data: { messageId: string; content: string }) => void;
  delete_message: (data: { messageId: string }) => void;
  typing_start: (data: { conversationId: string }) => void;
  typing_stop: (data: { conversationId: string }) => void;
  add_reaction: (data: { messageId: string; emoji: string }) => void;
  remove_reaction: (data: { messageId: string; emoji: string }) => void;

  // Threading events
  send_thread_reply: (data: {
    parentMessageId: string;
    content: string;
    driveFileIds?: string[];
  }) => void;
  get_thread_replies: (data: {
    parentMessageId: string;
    cursor?: string;
    limit?: number;
  }) => void;

  // Server to Client
  new_message: (message: Message) => void;
  message_edited: (data: { id: string; content: string; updatedAt: string }) => void;
  message_deleted: (data: {id: string; conversationId: string; isDeleted: boolean}) => void;
  user_typing: (data: { userId: string; conversationId: string }) => void;
  user_stopped_typing: (data: {
    userId: string;
    conversationId: string;
  }) => void;
  user_online: (userId: string) => void;
  user_offline: (userId: string) => void;
  error: (error: { message: string }) => void;

  // Task events
  task_created: (task: Task) => void;
  task_updated: (task: Task) => void;
  task_deleted: (taskId: string) => void;
  task_assigned: (data: { task: Task; assignedTo: User }) => void;
  task_created_by_member: (data: { task: Task; creator: User; adminId: string }) => void;
  reaction_added: (data: {
    messageId: string;
    reactions: Record<string, string[]>;
    userId: string;
    emoji: string;
  }) => void;
  reaction_removed: (data: {
    messageId: string;
    reactions: Record<string, string[]>;
    userId: string;
    emoji: string;
  }) => void;

  // Threading events
  thread_reply_added: (data: { reply: Message; parentMessageId: string }) => void;

  // Mention events
  mention_notification: (data: {
    messageId: string;
    conversationId: string;
    senderId: string;
    senderName: string;
    content: string;
    isThread: boolean;
    parentMessageId?: string;
  }) => void;

  // Daily Updates events
  daily_update_changed: (data: {
    date: Date;
    update?: DailyUpdate;
    deletedId?: string;
  }) => void;
  member_daily_update: (data: {
    updateId: string;
    date: Date;
    userId: string;
    userName: string;
    content: string;
  }) => void;

  // Reminder notifications
  reminder_notification: (data: {
    reminderId: string;
    noteId: string;
    noteTitle: string;
    noteContent: string;
    remindAt: string;
  }) => void;

  // Update reminder notifications
  update_reminder: (notification: UpdateReminderNotification) => void;
}

// Weekly Summaries Types
export type ImpactLevel = 'HIGH' | 'MEDIUM' | 'LOW';

export interface MemberWeeklySummary {
  id: string;
  weeklySummaryId: string;
  userId: string;
  summary: string;
  impactLevel: ImpactLevel;
  rawUpdates: {
    updates: Array<{ date: string; content: string }>;
    reasoning: string;
  };
  createdAt: string;
  user: User;
}

export interface WeeklySummary {
  id: string;
  weekStartDate: string;
  weekEndDate: string;
  generatedAt: string;
  emailSentAt?: string;
  createdAt: string;
  updatedAt: string;
  memberSummaries: MemberWeeklySummary[];
}

export interface GroupedWeeklySummary {
  id: string;
  weekStartDate: string;
  weekEndDate: string;
  generatedAt: string;
  emailSentAt?: string;
  grouped: {
    high: MemberWeeklySummary[];
    medium: MemberWeeklySummary[];
    low: MemberWeeklySummary[];
  };
  stats: {
    total: number;
    high: number;
    medium: number;
    low: number;
  };
}

export interface WeeklySummaryListItem {
  id: string;
  weekStartDate: string;
  weekEndDate: string;
  generatedAt: string;
  emailSentAt?: string;
  _count: {
    memberSummaries: number;
  };
}

export interface WeeklySummaryEmailConfig {
  enabled: boolean;
  recipientEmail: string;
  sendDay: 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';
  sendTime: string; // HH:MM format
}

export interface WeeklySummaryMembersConfig {
  includedUserIds: string[];
}

export interface AdminSetting<T = unknown> {
  key: string;
  value: T;
  updatedBy: string;
  updatedAt: string;
}

export interface AutomatedReminderConfig {
  enabled: boolean;
  sendTime: string; // HH:MM format (24-hour)
}

// Missing Updates Types
export type DateRangeType = 'current_week' | 'last_7_days' | 'last_14_days' | 'last_30_days';

export interface MissingUpdatesConfig {
  enabled: boolean;
  includedUserIds: string[];
  checkBusinessDaysOnly: boolean;
  defaultDateRange: DateRangeType;
}

export interface MissingUpdate {
  userId: string;
  userName: string;
  userEmail: string;
  missingDates: string[]; // YYYY-MM-DD format
}

export interface MissingUpdatesResult {
  users: MissingUpdate[];
  dateRange: {
    startDate: string;
    endDate: string;
  };
  totalUsers: number;
  totalMissingDays: number;
}

export interface UpdateReminderNotification {
  type: 'update_reminder';
  title: string;
  message: string;
  missingDates: string[];
  link: string;
  timestamp: string;
}

export interface SendUpdateReminderRequest {
  userId: string;
  missingDates: string[];
}

export interface SendUpdateReminderResponse {
  userId: string;
  missingDates: string[];
  sentAt: string;
  cooldownBypassed: boolean;
  timeRemainingMs: number;
}
