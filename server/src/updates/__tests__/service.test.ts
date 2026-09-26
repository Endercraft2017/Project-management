/**
 * Daily Updates Service Test Suite
 * Tests for late update submissions and date validation
 */

import { UpdatesService } from '../service';
import { prisma } from '@/database/client';
import { Role } from '@prisma/client';

describe('Daily Updates Service - Late Submissions', () => {
  let updatesService: UpdatesService;
  let testUser1Id: string;
  let testUser2Id: string;

  beforeAll(async () => {
    updatesService = new UpdatesService();

    // Create test users
    const user1 = await prisma.user.create({
      data: {
        email: 'test-updates-user1@servicebay.ai',
        name: 'Test User 1',
        role: Role.MEMBER,
        isActive: true,
      },
    });
    testUser1Id = user1.id;

    const user2 = await prisma.user.create({
      data: {
        email: 'test-updates-user2@servicebay.ai',
        name: 'Test User 2',
        role: Role.MEMBER,
        isActive: true,
      },
    });
    testUser2Id = user2.id;
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.dailyUpdate.deleteMany({
      where: {
        userId: {
          in: [testUser1Id, testUser2Id],
        },
      },
    });
    await prisma.user.deleteMany({
      where: {
        email: {
          contains: 'test-updates-',
        },
      },
    });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up updates before each test
    await prisma.dailyUpdate.deleteMany({
      where: {
        userId: {
          in: [testUser1Id, testUser2Id],
        },
      },
    });
  });

  describe('createOrUpdateUpdate', () => {
    it('should allow creating update for today', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const update = await updatesService.createOrUpdateUpdate(
        testUser1Id,
        today,
        'Today\'s update'
      );

      expect(update).toBeDefined();
      expect(update.content).toBe('Today\'s update');
      expect(update.userId).toBe(testUser1Id);
    });

    it('should allow creating update for past dates (late submission)', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);

      const update = await updatesService.createOrUpdateUpdate(
        testUser1Id,
        yesterday,
        'Yesterday\'s late update'
      );

      expect(update).toBeDefined();
      expect(update.content).toBe('Yesterday\'s late update');
      expect(update.userId).toBe(testUser1Id);
    });

    it('should allow updating an existing update', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Create initial update
      const initial = await updatesService.createOrUpdateUpdate(
        testUser1Id,
        today,
        'Initial content'
      );

      // Update the same day
      const updated = await updatesService.createOrUpdateUpdate(
        testUser1Id,
        today,
        'Updated content'
      );

      expect(updated.id).toBe(initial.id);
      expect(updated.content).toBe('Updated content');
      expect(updated.updatedAt.getTime()).toBeGreaterThan(updated.createdAt.getTime());
    });

    it('should enforce one update per user per day constraint', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Create first update
      await updatesService.createOrUpdateUpdate(testUser1Id, today, 'First update');

      // Create second update for same user and date - should update, not create new
      const result = await updatesService.createOrUpdateUpdate(
        testUser1Id,
        today,
        'Second update'
      );

      // Verify only one update exists
      const updates = await prisma.dailyUpdate.findMany({
        where: {
          userId: testUser1Id,
          date: today,
        },
      });

      expect(updates).toHaveLength(1);
      expect(updates[0].content).toBe('Second update');
    });

    it('should allow different users to submit for the same day', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      await updatesService.createOrUpdateUpdate(testUser1Id, today, 'User 1 update');
      await updatesService.createOrUpdateUpdate(testUser2Id, today, 'User 2 update');

      const updates = await updatesService.getDayUpdates(today);

      expect(updates).toHaveLength(2);
      expect(updates.map((u) => u.userId)).toContain(testUser1Id);
      expect(updates.map((u) => u.userId)).toContain(testUser2Id);
    });
  });

  describe('getDayUpdates', () => {
    it('should return all updates for a specific day', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      await updatesService.createOrUpdateUpdate(testUser1Id, today, 'Update 1');
      await updatesService.createOrUpdateUpdate(testUser2Id, today, 'Update 2');

      const updates = await updatesService.getDayUpdates(today);

      expect(updates).toHaveLength(2);
      expect(updates[0].user).toBeDefined();
      expect(updates[0].user.name).toBeDefined();
    });

    it('should return empty array for day with no updates', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 10);
      futureDate.setHours(0, 0, 0, 0);

      const updates = await updatesService.getDayUpdates(futureDate);

      expect(updates).toEqual([]);
    });
  });

  describe('getMissingMembersForDate', () => {
    it('should return users who have not submitted for a specific date', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Only user1 submits
      await updatesService.createOrUpdateUpdate(testUser1Id, today, 'User 1 update');

      const missingMembers = await updatesService.getMissingMembersForDate(today);

      // User2 should be in missing members
      expect(missingMembers.some((m) => m.id === testUser2Id)).toBe(true);
      // User1 should not be in missing members
      expect(missingMembers.some((m) => m.id === testUser1Id)).toBe(false);
    });

    it('should return all active users when no one has submitted', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);

      const missingMembers = await updatesService.getMissingMembersForDate(yesterday);

      // Both test users should be in missing members
      expect(missingMembers.some((m) => m.id === testUser1Id)).toBe(true);
      expect(missingMembers.some((m) => m.id === testUser2Id)).toBe(true);
    });

    it('should return empty array when everyone has submitted', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Both users submit
      await updatesService.createOrUpdateUpdate(testUser1Id, today, 'User 1 update');
      await updatesService.createOrUpdateUpdate(testUser2Id, today, 'User 2 update');

      const missingMembers = await updatesService.getMissingMembersForDate(today);

      // Neither test user should be in missing members
      expect(missingMembers.some((m) => m.id === testUser1Id)).toBe(false);
      expect(missingMembers.some((m) => m.id === testUser2Id)).toBe(false);
    });

    it('should only include active users in missing members', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Create inactive user
      const inactiveUser = await prisma.user.create({
        data: {
          email: 'test-updates-inactive@servicebay.ai',
          name: 'Inactive User',
          role: Role.MEMBER,
          isActive: false,
        },
      });

      const missingMembers = await updatesService.getMissingMembersForDate(today);

      // Inactive user should not be in missing members
      expect(missingMembers.some((m) => m.id === inactiveUser.id)).toBe(false);

      // Clean up
      await prisma.user.delete({ where: { id: inactiveUser.id } });
    });
  });

  describe('getUserUpdateForDate', () => {
    it('should return user\'s update for a specific date', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      await updatesService.createOrUpdateUpdate(testUser1Id, today, 'My update');

      const userUpdate = await updatesService.getUserUpdateForDate(testUser1Id, today);

      expect(userUpdate).toBeDefined();
      expect(userUpdate?.content).toBe('My update');
      expect(userUpdate?.userId).toBe(testUser1Id);
    });

    it('should return null if user has not submitted for the date', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);

      const userUpdate = await updatesService.getUserUpdateForDate(testUser1Id, yesterday);

      expect(userUpdate).toBeNull();
    });
  });

  describe('deleteUpdate', () => {
    it('should allow user to delete their own update', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const update = await updatesService.createOrUpdateUpdate(
        testUser1Id,
        today,
        'Update to delete'
      );

      const result = await updatesService.deleteUpdate(update.id, testUser1Id);

      expect(result.success).toBe(true);

      // Verify update is deleted
      const deleted = await prisma.dailyUpdate.findUnique({
        where: { id: update.id },
      });
      expect(deleted).toBeNull();
    });

    it('should prevent user from deleting another user\'s update', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const update = await updatesService.createOrUpdateUpdate(
        testUser1Id,
        today,
        'User 1 update'
      );

      // User 2 tries to delete User 1's update
      await expect(updatesService.deleteUpdate(update.id, testUser2Id)).rejects.toThrow(
        'Unauthorized: You can only delete your own updates'
      );
    });

    it('should throw error when deleting non-existent update', async () => {
      await expect(updatesService.deleteUpdate('non-existent-id', testUser1Id)).rejects.toThrow(
        'Update not found'
      );
    });
  });

  describe('listDays', () => {
    it('should return unique days with updates in descending order', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const twoDaysAgo = new Date(today);
      twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

      // Create updates for different days
      await updatesService.createOrUpdateUpdate(testUser1Id, today, 'Today');
      await updatesService.createOrUpdateUpdate(testUser1Id, yesterday, 'Yesterday');
      await updatesService.createOrUpdateUpdate(testUser2Id, yesterday, 'Yesterday 2');
      await updatesService.createOrUpdateUpdate(testUser1Id, twoDaysAgo, 'Two days ago');

      const days = await updatesService.listDays();

      // Should have 3 unique days
      expect(days.length).toBeGreaterThanOrEqual(3);

      // Should be in descending order (most recent first)
      const relevantDays = days.slice(0, 3);
      expect(new Date(relevantDays[0]).getTime()).toBeGreaterThanOrEqual(
        new Date(relevantDays[1]).getTime()
      );
      expect(new Date(relevantDays[1]).getTime()).toBeGreaterThanOrEqual(
        new Date(relevantDays[2]).getTime()
      );
    });
  });
});
