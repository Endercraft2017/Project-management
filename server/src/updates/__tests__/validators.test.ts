/**
 * Daily Updates Validators Test Suite
 * Tests for date range validation
 */

import { createOrUpdateUpdateSchema, getDayUpdatesSchema } from '../validators';

describe('Daily Updates Validators', () => {
  describe('createOrUpdateUpdateSchema', () => {
    it('should accept valid update for today', () => {
      const today = new Date().toISOString().split('T')[0];

      const result = createOrUpdateUpdateSchema.safeParse({
        date: today,
        content: 'Valid update content',
      });

      expect(result.success).toBe(true);
    });

    it('should accept valid update for yesterday', () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const dateStr = yesterday.toISOString().split('T')[0];

      const result = createOrUpdateUpdateSchema.safeParse({
        date: dateStr,
        content: 'Valid update content',
      });

      expect(result.success).toBe(true);
    });

    it('should accept update for date within 30 days', () => {
      const twentyDaysAgo = new Date();
      twentyDaysAgo.setDate(twentyDaysAgo.getDate() - 20);
      const dateStr = twentyDaysAgo.toISOString().split('T')[0];

      const result = createOrUpdateUpdateSchema.safeParse({
        date: dateStr,
        content: 'Valid late update',
      });

      expect(result.success).toBe(true);
    });

    it('should reject update for future date', () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dateStr = tomorrow.toISOString().split('T')[0];

      const result = createOrUpdateUpdateSchema.safeParse({
        date: dateStr,
        content: 'Invalid future update',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('within the last 30 days');
      }
    });

    it('should reject update for date more than 30 days in the past', () => {
      const longAgo = new Date();
      longAgo.setDate(longAgo.getDate() - 31);
      const dateStr = longAgo.toISOString().split('T')[0];

      const result = createOrUpdateUpdateSchema.safeParse({
        date: dateStr,
        content: 'Too old update',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('within the last 30 days');
      }
    });

    it('should accept update for exactly 30 days ago', () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const dateStr = thirtyDaysAgo.toISOString().split('T')[0];

      const result = createOrUpdateUpdateSchema.safeParse({
        date: dateStr,
        content: 'Valid update at boundary',
      });

      expect(result.success).toBe(true);
    });

    it('should reject invalid date format', () => {
      const result = createOrUpdateUpdateSchema.safeParse({
        date: '2025-1-1', // Should be 2025-01-01
        content: 'Valid content',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('YYYY-MM-DD format');
      }
    });

    it('should reject empty content', () => {
      const today = new Date().toISOString().split('T')[0];

      const result = createOrUpdateUpdateSchema.safeParse({
        date: today,
        content: '',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('cannot be empty');
      }
    });

    it('should reject content that is too long', () => {
      const today = new Date().toISOString().split('T')[0];
      const longContent = 'x'.repeat(5001);

      const result = createOrUpdateUpdateSchema.safeParse({
        date: today,
        content: longContent,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('too long');
      }
    });

    it('should accept content at maximum length', () => {
      const today = new Date().toISOString().split('T')[0];
      const maxContent = 'x'.repeat(5000);

      const result = createOrUpdateUpdateSchema.safeParse({
        date: today,
        content: maxContent,
      });

      expect(result.success).toBe(true);
    });

    it('should reject non-string date', () => {
      const result = createOrUpdateUpdateSchema.safeParse({
        date: new Date(),
        content: 'Valid content',
      });

      expect(result.success).toBe(false);
    });

    it('should trim and accept content with whitespace', () => {
      const today = new Date().toISOString().split('T')[0];

      const result = createOrUpdateUpdateSchema.safeParse({
        date: today,
        content: '  Valid content with whitespace  ',
      });

      expect(result.success).toBe(true);
    });
  });

  describe('getDayUpdatesSchema', () => {
    it('should accept valid date format', () => {
      const result = getDayUpdatesSchema.safeParse({
        date: '2025-01-15',
      });

      expect(result.success).toBe(true);
    });

    it('should reject invalid date format', () => {
      const result = getDayUpdatesSchema.safeParse({
        date: '2025-1-15',
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0].message).toContain('YYYY-MM-DD format');
      }
    });

    it('should reject date with time component', () => {
      const result = getDayUpdatesSchema.safeParse({
        date: '2025-01-15T12:00:00Z',
      });

      expect(result.success).toBe(false);
    });

    it('should reject non-string date', () => {
      const result = getDayUpdatesSchema.safeParse({
        date: new Date(),
      });

      expect(result.success).toBe(false);
    });
  });
});
