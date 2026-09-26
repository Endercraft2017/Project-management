/**
 * Invitation Service Test Suite
 * Integration tests for case-insensitive email handling in invitations
 */

import { createInvite, acceptInvite } from '../service';
import { prisma } from '@/database/client';
import { Role, InviteStatus } from '@prisma/client';

// Mock dependencies
jest.mock('@/lib/email', () => ({
  sendInvitationEmail: jest.fn().mockResolvedValue(undefined),
}));

describe('Invitation Service - Case Insensitive Email Handling', () => {
  let testInviterId: string;

  beforeAll(async () => {
    // Create a test admin user for inviting
    const admin = await prisma.user.create({
      data: {
        email: 'test-admin@servicebay.ai',
        name: 'Test Admin',
        role: Role.ADMIN,
        isActive: true,
      },
    });
    testInviterId = admin.id;
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.teamInvite.deleteMany({
      where: {
        email: {
          contains: 'test-',
        },
      },
    });
    await prisma.user.deleteMany({
      where: {
        email: {
          contains: 'test-',
        },
      },
    });
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up invites before each test
    await prisma.teamInvite.deleteMany({
      where: {
        email: {
          startsWith: 'test-case-',
        },
      },
    });
    await prisma.user.deleteMany({
      where: {
        email: {
          startsWith: 'test-case-',
        },
      },
    });
  });

  describe('createInvite', () => {
    it('should normalize email to lowercase when creating invite', async () => {
      const email = 'Test-Case-User1@ServiceBay.AI';

      const invite = await createInvite(email, Role.MEMBER, testInviterId);

      expect(invite.email).toBe('test-case-user1@servicebay.ai');
    });

    it('should prevent duplicate invites with different case', async () => {
      const email1 = 'test-case-user2@servicebay.ai';
      const email2 = 'Test-Case-User2@ServiceBay.AI';

      await createInvite(email1, Role.MEMBER, testInviterId);

      await expect(createInvite(email2, Role.MEMBER, testInviterId)).rejects.toThrow(
        'An active invitation already exists for this email'
      );
    });

    it('should detect existing users regardless of case', async () => {
      const email = 'test-case-existing@servicebay.ai';

      // Create user with lowercase email
      await prisma.user.create({
        data: {
          email: email.toLowerCase(),
          name: 'Existing User',
          role: Role.MEMBER,
          isActive: true,
        },
      });

      // Try to invite with different case
      await expect(createInvite('Test-Case-Existing@ServiceBay.AI', Role.MEMBER, testInviterId)).rejects.toThrow(
        'User with this email already exists'
      );
    });

    it('should validate domain case-insensitively', async () => {
      const validEmails = [
        'user@SERVICEBAY.AI',
        'user@ServiceBay.AI',
        'user@servicebay.ai',
        'user@ServiceBay.ai',
      ];

      for (const email of validEmails) {
        const testEmail = `test-case-domain-${Date.now()}@servicebay.ai`;
        const invite = await createInvite(testEmail, Role.MEMBER, testInviterId);
        expect(invite.email).toBe(testEmail.toLowerCase());

        // Clean up
        await prisma.teamInvite.delete({ where: { id: invite.id } });
      }
    });

    it('should reject invalid domains regardless of case', async () => {
      const invalidEmails = ['user@GMAIL.COM', 'user@Gmail.Com', 'user@gmail.com'];

      for (const email of invalidEmails) {
        await expect(createInvite(email, Role.MEMBER, testInviterId)).rejects.toThrow(
          'Only @servicebay.ai email addresses are allowed'
        );
      }
    });
  });

  describe('acceptInvite', () => {
    it('should accept invite with case-insensitive email matching', async () => {
      // Create invite with mixed case
      const inviteEmail = 'Test-Case-Accept1@ServiceBay.AI';
      const invite = await createInvite(inviteEmail, Role.MEMBER, testInviterId);

      // Accept with different case (simulating Google OAuth)
      const result = await acceptInvite(invite.token, {
        name: 'Test User',
      });

      expect(result.user.email).toBe('test-case-accept1@servicebay.ai');
      expect(result.user.role).toBe(Role.MEMBER);
    });

    it('should prevent duplicate user creation with different case', async () => {
      const email = 'test-case-duplicate@servicebay.ai';
      const invite = await createInvite(email, Role.MEMBER, testInviterId);

      // Accept invite
      await acceptInvite(invite.token, { name: 'First Accept' });

      // Create another invite with different case
      const invite2 = await createInvite(`test-case-duplicate-2@servicebay.ai`, Role.MEMBER, testInviterId);

      // Manually create conflicting user with different case
      await prisma.user.create({
        data: {
          email: 'Test-Case-Conflict@ServiceBay.AI',
          name: 'Conflict User',
          role: Role.MEMBER,
          isActive: true,
        },
      });

      // Create invite for conflicting email
      const conflictInvite = await prisma.teamInvite.create({
        data: {
          email: 'test-case-conflict@servicebay.ai',
          token: 'test-conflict-token',
          role: Role.MEMBER,
          invitedById: testInviterId,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      });

      // Try to accept - should fail due to existing user
      await expect(
        acceptInvite(conflictInvite.token, { name: 'Should Fail' })
      ).rejects.toThrow('User account already exists for this email');
    });
  });

  describe('Real-world bug scenario', () => {
    it('should handle the Kaduan@servicebay.ai bug scenario', async () => {
      // Step 1: Admin invites "Kaduan@servicebay.ai" (with capital K)
      const invitedEmail = 'Kaduan@servicebay.ai';
      const invite = await createInvite(invitedEmail, Role.MEMBER, testInviterId);

      // Verify invite is stored with normalized email
      expect(invite.email).toBe('kaduan@servicebay.ai');

      // Step 2: User accepts via Google, which returns "kaduan@servicebay.ai" (lowercase)
      const googleEmail = 'kaduan@servicebay.ai';

      // Step 3: Accept invite - should work without errors
      const result = await acceptInvite(invite.token, {
        name: 'Kaduan User',
        googleId: 'google-id-123',
      });

      // Verify user was created successfully
      expect(result.user.email).toBe('kaduan@servicebay.ai');
      expect(result.user.name).toBe('Kaduan User');
      expect(result.user.role).toBe(Role.MEMBER);

      // Step 4: Verify invite was marked as accepted
      const updatedInvite = await prisma.teamInvite.findUnique({
        where: { id: invite.id },
      });
      expect(updatedInvite?.status).toBe(InviteStatus.ACCEPTED);
      expect(updatedInvite?.acceptedAt).not.toBeNull();

      // Step 5: Verify user exists in database with lowercase email
      const user = await prisma.user.findUnique({
        where: { id: result.user.id },
      });
      expect(user?.email).toBe('kaduan@servicebay.ai');
      expect(user?.isActive).toBe(true);
    });
  });
});
