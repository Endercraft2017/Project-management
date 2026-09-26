/**
 * Email Utilities Test Suite
 * Tests for case-insensitive email handling
 */

import { normalizeEmail, isValidDomain, emailsMatch } from '../email-utils';

describe('Email Utils', () => {
  describe('normalizeEmail', () => {
    it('should convert email to lowercase', () => {
      expect(normalizeEmail('USER@EXAMPLE.COM')).toBe('user@example.com');
      expect(normalizeEmail('Admin@ServiceBay.AI')).toBe('admin@servicebay.ai');
      expect(normalizeEmail('Test.User@ServiceBay.AI')).toBe('test.user@servicebay.ai');
    });

    it('should trim whitespace', () => {
      expect(normalizeEmail('  user@example.com  ')).toBe('user@example.com');
      expect(normalizeEmail('\tuser@example.com\n')).toBe('user@example.com');
    });

    it('should handle already normalized emails', () => {
      expect(normalizeEmail('user@example.com')).toBe('user@example.com');
      expect(normalizeEmail('admin@servicebay.ai')).toBe('admin@servicebay.ai');
    });

    it('should handle mixed case emails', () => {
      expect(normalizeEmail('UsEr@ExAmPlE.CoM')).toBe('user@example.com');
      expect(normalizeEmail('KaDuAn@SeRvIcEbAy.Ai')).toBe('kaduan@servicebay.ai');
    });

    it('should throw error for invalid input', () => {
      expect(() => normalizeEmail('')).toThrow('Invalid email');
      expect(() => normalizeEmail(null as any)).toThrow('Invalid email');
      expect(() => normalizeEmail(undefined as any)).toThrow('Invalid email');
      expect(() => normalizeEmail(123 as any)).toThrow('Invalid email');
    });

    it('should handle edge cases', () => {
      expect(normalizeEmail('a@b.c')).toBe('a@b.c');
      expect(normalizeEmail('VERY.LONG.EMAIL.ADDRESS@SUBDOMAIN.EXAMPLE.COM')).toBe(
        'very.long.email.address@subdomain.example.com'
      );
    });
  });

  describe('isValidDomain', () => {
    it('should validate @servicebay.ai domain (default)', () => {
      expect(isValidDomain('user@servicebay.ai')).toBe(true);
      expect(isValidDomain('admin@servicebay.ai')).toBe(true);
      expect(isValidDomain('test.user@servicebay.ai')).toBe(true);
    });

    it('should reject invalid domains', () => {
      expect(isValidDomain('user@gmail.com')).toBe(false);
      expect(isValidDomain('user@example.com')).toBe(false);
      expect(isValidDomain('user@servicebay.com')).toBe(false);
    });

    it('should be case-insensitive', () => {
      expect(isValidDomain('USER@SERVICEBAY.AI')).toBe(true);
      expect(isValidDomain('Admin@ServiceBay.AI')).toBe(true);
      expect(isValidDomain('USER@GMAIL.COM')).toBe(false);
    });

    it('should work with custom domains', () => {
      expect(isValidDomain('user@example.com', '@example.com')).toBe(true);
      expect(isValidDomain('admin@test.org', '@test.org')).toBe(true);
      expect(isValidDomain('user@wrong.com', '@example.com')).toBe(false);
    });

    it('should handle whitespace in emails', () => {
      expect(isValidDomain('  user@servicebay.ai  ')).toBe(true);
      expect(isValidDomain('  user@gmail.com  ')).toBe(false);
    });
  });

  describe('emailsMatch', () => {
    it('should match emails case-insensitively', () => {
      expect(emailsMatch('user@example.com', 'USER@EXAMPLE.COM')).toBe(true);
      expect(emailsMatch('Admin@ServiceBay.AI', 'admin@servicebay.ai')).toBe(true);
      expect(emailsMatch('Kaduan@ServiceBay.AI', 'kaduan@servicebay.ai')).toBe(true);
    });

    it('should not match different emails', () => {
      expect(emailsMatch('user1@example.com', 'user2@example.com')).toBe(false);
      expect(emailsMatch('admin@servicebay.ai', 'user@servicebay.ai')).toBe(false);
    });

    it('should handle whitespace', () => {
      expect(emailsMatch('  user@example.com  ', 'user@example.com')).toBe(true);
      expect(emailsMatch('user@example.com', '  USER@EXAMPLE.COM  ')).toBe(true);
    });

    it('should match identical emails', () => {
      expect(emailsMatch('user@example.com', 'user@example.com')).toBe(true);
      expect(emailsMatch('ADMIN@SERVICEBAY.AI', 'ADMIN@SERVICEBAY.AI')).toBe(true);
    });

    it('should handle mixed case in domain and local part', () => {
      expect(emailsMatch('User@Example.Com', 'uSeR@eXaMpLe.cOm')).toBe(true);
      expect(emailsMatch('TeSt.UsEr@SeRvIcE.CoM', 'test.user@service.com')).toBe(true);
    });
  });

  describe('Real-world scenarios', () => {
    it('should handle the reported bug scenario', () => {
      // Admin invites: "Kaduan@servicebay.ai"
      const invitedEmail = 'Kaduan@servicebay.ai';
      const normalizedInvite = normalizeEmail(invitedEmail);

      // Google returns: "kaduan@servicebay.ai"
      const googleEmail = 'kaduan@servicebay.ai';
      const normalizedGoogle = normalizeEmail(googleEmail);

      // Both should normalize to the same value
      expect(normalizedInvite).toBe(normalizedGoogle);
      expect(normalizedInvite).toBe('kaduan@servicebay.ai');

      // emailsMatch should return true
      expect(emailsMatch(invitedEmail, googleEmail)).toBe(true);
    });

    it('should handle common case variations', () => {
      const testCases = [
        ['john.doe@servicebay.ai', 'John.Doe@ServiceBay.AI'],
        ['ADMIN@SERVICEBAY.AI', 'admin@servicebay.ai'],
        ['Test.User@ServiceBay.AI', 'test.user@servicebay.ai'],
        ['jane.SMITH@ServiceBay.ai', 'Jane.Smith@SERVICEBAY.AI'],
      ];

      testCases.forEach(([email1, email2]) => {
        expect(emailsMatch(email1, email2)).toBe(true);
        expect(normalizeEmail(email1)).toBe(normalizeEmail(email2));
      });
    });
  });
});
