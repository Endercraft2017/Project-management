/**
 * Admin Settings Service
 * Manages system-wide configuration settings
 */

import prisma from '@/database/client';
import { z } from 'zod';

/**
 * Weekly summary email configuration
 */
export const WeeklySummaryEmailConfigSchema = z.object({
  enabled: z.boolean(),
  recipientEmail: z.string().email(),
  sendDay: z.enum(['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY']),
  sendTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Time must be in HH:MM format'),
});

export type WeeklySummaryEmailConfig = z.infer<typeof WeeklySummaryEmailConfigSchema>;

/**
 * Weekly summary member selection configuration
 */
export const WeeklySummaryMembersConfigSchema = z.object({
  includedUserIds: z.array(z.string().uuid()),
});

export type WeeklySummaryMembersConfig = z.infer<typeof WeeklySummaryMembersConfigSchema>;

/**
 * Missing updates tracking configuration
 */
export const MissingUpdatesConfigSchema = z.object({
  enabled: z.boolean(),
  includedUserIds: z.array(z.string().uuid()),
  checkBusinessDaysOnly: z.boolean(),
  defaultDateRange: z.enum(['current_week', 'last_7_days', 'last_14_days', 'last_30_days']),
});

export type MissingUpdatesConfig = z.infer<typeof MissingUpdatesConfigSchema>;

/**
 * Automated daily reminder configuration
 */
export const AutomatedReminderConfigSchema = z.object({
  enabled: z.boolean(),
  sendTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'Time must be in HH:MM format'),
});

export type AutomatedReminderConfig = z.infer<typeof AutomatedReminderConfigSchema>;

/**
 * Setting keys for different configurations
 */
export const SETTING_KEYS = {
  WEEKLY_SUMMARY_EMAIL: 'weekly_summary_email',
  WEEKLY_SUMMARY_MEMBERS: 'weekly_summary_members',
  MISSING_UPDATES_CONFIG: 'missing_updates_config',
  AUTOMATED_REMINDER: 'automated_reminder',
} as const;

export class AdminSettingsService {
  /**
   * Get a setting by key
   */
  async getSetting(key: string) {
    const setting = await prisma.adminSetting.findUnique({
      where: { key },
    });

    if (!setting) {
      return null;
    }

    try {
      return {
        key: setting.key,
        value: JSON.parse(setting.value),
        updatedBy: setting.updatedBy,
        updatedAt: setting.updatedAt,
      };
    } catch (error) {
      throw new Error(`Failed to parse setting value for key: ${key}`);
    }
  }

  /**
   * Set a setting value
   */
  async setSetting(key: string, value: unknown, userId: string) {
    // Validate the value based on the key
    if (key === SETTING_KEYS.WEEKLY_SUMMARY_EMAIL) {
      WeeklySummaryEmailConfigSchema.parse(value);
    } else if (key === SETTING_KEYS.WEEKLY_SUMMARY_MEMBERS) {
      WeeklySummaryMembersConfigSchema.parse(value);
    } else if (key === SETTING_KEYS.MISSING_UPDATES_CONFIG) {
      MissingUpdatesConfigSchema.parse(value);
    } else if (key === SETTING_KEYS.AUTOMATED_REMINDER) {
      AutomatedReminderConfigSchema.parse(value);
    }

    const setting = await prisma.adminSetting.upsert({
      where: { key },
      update: {
        value: JSON.stringify(value),
        updatedBy: userId,
        updatedAt: new Date(),
      },
      create: {
        key,
        value: JSON.stringify(value),
        updatedBy: userId,
      },
    });

    return {
      key: setting.key,
      value: JSON.parse(setting.value),
      updatedBy: setting.updatedBy,
      updatedAt: setting.updatedAt,
    };
  }

  /**
   * Get weekly summary email configuration
   */
  async getWeeklySummaryEmailConfig(): Promise<WeeklySummaryEmailConfig | null> {
    const setting = await this.getSetting(SETTING_KEYS.WEEKLY_SUMMARY_EMAIL);

    if (!setting) {
      return null;
    }

    return WeeklySummaryEmailConfigSchema.parse(setting.value);
  }

  /**
   * Set weekly summary email configuration
   */
  async setWeeklySummaryEmailConfig(
    config: WeeklySummaryEmailConfig,
    userId: string
  ) {
    return this.setSetting(SETTING_KEYS.WEEKLY_SUMMARY_EMAIL, config, userId);
  }

  /**
   * Get weekly summary member selection configuration
   */
  async getWeeklySummaryMembersConfig(): Promise<WeeklySummaryMembersConfig | null> {
    const setting = await this.getSetting(SETTING_KEYS.WEEKLY_SUMMARY_MEMBERS);

    if (!setting) {
      return null;
    }

    return WeeklySummaryMembersConfigSchema.parse(setting.value);
  }

  /**
   * Set weekly summary member selection configuration
   */
  async setWeeklySummaryMembersConfig(
    config: WeeklySummaryMembersConfig,
    userId: string
  ) {
    // Validate that all user IDs exist and are active
    const users = await prisma.user.findMany({
      where: {
        id: { in: config.includedUserIds },
        isActive: true,
      },
      select: { id: true },
    });

    const validUserIds = users.map((u) => u.id);

    // Filter out invalid user IDs
    const filteredConfig = {
      includedUserIds: validUserIds,
    };

    return this.setSetting(SETTING_KEYS.WEEKLY_SUMMARY_MEMBERS, filteredConfig, userId);
  }

  /**
   * List all settings
   */
  async listSettings() {
    const settings = await prisma.adminSetting.findMany({
      orderBy: { key: 'asc' },
    });

    return settings.map((setting) => ({
      key: setting.key,
      value: JSON.parse(setting.value),
      updatedBy: setting.updatedBy,
      updatedAt: setting.updatedAt,
    }));
  }

  /**
   * Get missing updates tracking configuration
   */
  async getMissingUpdatesConfig(): Promise<MissingUpdatesConfig | null> {
    const setting = await this.getSetting(SETTING_KEYS.MISSING_UPDATES_CONFIG);

    if (!setting) {
      return null;
    }

    return MissingUpdatesConfigSchema.parse(setting.value);
  }

  /**
   * Set missing updates tracking configuration
   */
  async setMissingUpdatesConfig(
    config: MissingUpdatesConfig,
    userId: string
  ) {
    // Validate that all user IDs exist and are active
    const users = await prisma.user.findMany({
      where: {
        id: { in: config.includedUserIds },
        isActive: true,
      },
      select: { id: true },
    });

    const validUserIds = users.map((u) => u.id);

    // Filter out invalid user IDs
    const filteredConfig = {
      ...config,
      includedUserIds: validUserIds,
    };

    return this.setSetting(SETTING_KEYS.MISSING_UPDATES_CONFIG, filteredConfig, userId);
  }

  /**
   * Delete a setting
   */
  async deleteSetting(key: string) {
    await prisma.adminSetting.delete({
      where: { key },
    });

    return { success: true };
  }

  /**
   * Get automated daily reminder configuration
   */
  async getAutomatedReminderConfig(): Promise<AutomatedReminderConfig | null> {
    const setting = await this.getSetting(SETTING_KEYS.AUTOMATED_REMINDER);

    if (!setting) {
      return null;
    }

    return AutomatedReminderConfigSchema.parse(setting.value);
  }

  /**
   * Set automated daily reminder configuration
   */
  async setAutomatedReminderConfig(
    config: AutomatedReminderConfig,
    userId: string
  ) {
    return this.setSetting(SETTING_KEYS.AUTOMATED_REMINDER, config, userId);
  }
}

export const adminSettingsService = new AdminSettingsService();
