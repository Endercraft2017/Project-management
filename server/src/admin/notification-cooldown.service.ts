/**
 * Notification Cooldown Service
 * Tracks and enforces cooldown periods for update reminder notifications
 */

export interface NotificationRecord {
  userId: string;
  sentAt: Date;
  sentBy: 'admin' | 'auto';
  missingDates: string[];
}

export class NotificationCooldownService {
  // In-memory store for notification records
  // Key: userId, Value: NotificationRecord[]
  private notificationHistory: Map<string, NotificationRecord[]> = new Map();

  // Cooldown period in milliseconds (5 hours)
  private readonly COOLDOWN_PERIOD_MS = 5 * 60 * 60 * 1000;

  /**
   * Record a notification being sent
   */
  recordNotification(
    userId: string,
    sentBy: 'admin' | 'auto',
    missingDates: string[]
  ): void {
    const record: NotificationRecord = {
      userId,
      sentAt: new Date(),
      sentBy,
      missingDates,
    };

    if (!this.notificationHistory.has(userId)) {
      this.notificationHistory.set(userId, []);
    }

    this.notificationHistory.get(userId)!.push(record);

    // Clean up old records (older than 24 hours)
    this.cleanupOldRecords(userId);
  }

  /**
   * Check if a notification can be sent to a user
   * @param userId - User ID
   * @param sentBy - Who is sending the notification
   * @returns true if notification can be sent, false otherwise
   */
  canSendNotification(userId: string, sentBy: 'admin' | 'auto'): boolean {
    const records = this.notificationHistory.get(userId);

    if (!records || records.length === 0) {
      return true; // No previous notifications
    }

    const now = new Date();

    // Find the most recent notification
    const recentNotifications = records.filter((record) => {
      const timeSinceSent = now.getTime() - record.sentAt.getTime();
      return timeSinceSent < this.COOLDOWN_PERIOD_MS;
    });

    if (recentNotifications.length === 0) {
      return true; // No notifications within cooldown period
    }

    // Admin notifications can always be sent (bypass cooldown)
    if (sentBy === 'admin') {
      return true;
    }

    // For auto notifications, check if there's a recent notification
    // regardless of who sent it
    const hasRecentNotification = recentNotifications.some((record) => {
      return record.sentBy === 'auto';
    });

    return !hasRecentNotification;
  }

  /**
   * Get time remaining before next notification can be sent
   * @param userId - User ID
   * @returns Milliseconds remaining, or 0 if notification can be sent
   */
  getTimeRemaining(userId: string): number {
    const records = this.notificationHistory.get(userId);

    if (!records || records.length === 0) {
      return 0;
    }

    const now = new Date();
    const recentAutoNotifications = records.filter(
      (record) => record.sentBy === 'auto'
    );

    if (recentAutoNotifications.length === 0) {
      return 0;
    }

    // Find the most recent auto notification
    const mostRecent = recentAutoNotifications.reduce((latest, record) =>
      record.sentAt > latest.sentAt ? record : latest
    );

    const timeSinceSent = now.getTime() - mostRecent.sentAt.getTime();
    const timeRemaining = this.COOLDOWN_PERIOD_MS - timeSinceSent;

    return Math.max(0, timeRemaining);
  }

  /**
   * Get notification history for a user
   * @param userId - User ID
   * @param limit - Max number of records to return
   */
  getNotificationHistory(userId: string, limit: number = 10): NotificationRecord[] {
    const records = this.notificationHistory.get(userId);

    if (!records) {
      return [];
    }

    return records
      .sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime())
      .slice(0, limit);
  }

  /**
   * Clean up old notification records (older than 24 hours)
   */
  private cleanupOldRecords(userId: string): void {
    const records = this.notificationHistory.get(userId);

    if (!records) {
      return;
    }

    const now = new Date();
    const twentyFourHoursAgo = now.getTime() - 24 * 60 * 60 * 1000;

    const recentRecords = records.filter(
      (record) => record.sentAt.getTime() > twentyFourHoursAgo
    );

    if (recentRecords.length > 0) {
      this.notificationHistory.set(userId, recentRecords);
    } else {
      this.notificationHistory.delete(userId);
    }
  }

  /**
   * Clear all notification history (for testing or reset)
   */
  clearAll(): void {
    this.notificationHistory.clear();
  }

  /**
   * Clear notification history for a specific user
   */
  clearUser(userId: string): void {
    this.notificationHistory.delete(userId);
  }
}

export const notificationCooldownService = new NotificationCooldownService();
