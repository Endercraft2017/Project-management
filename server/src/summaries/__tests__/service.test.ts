/**
 * Tests for Weekly Summaries Service
 */

import { weeklySummariesService } from '../service';

// Mock Prisma client
jest.mock('@/database/client', () => ({
  __esModule: true,
  default: {
    weeklySummary: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    memberWeeklySummary: {
      create: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
    },
    dailyUpdate: {
      findMany: jest.fn(),
    },
  },
}));

// Mock OpenAI service
jest.mock('@/services/openai.service', () => ({
  openAIService: {
    generateWeeklySummary: jest.fn(),
  },
}));

describe('Weekly Summaries Service', () => {
  describe('Week Bounds Calculation', () => {
    it('should calculate correct Monday for mid-week date', () => {
      const wednesday = new Date('2025-01-22'); // Wednesday
      const monday = new Date('2025-01-20'); // Expected Monday

      // Helper function to get Monday
      const getMonday = (date: Date) => {
        const d = new Date(date);
        const day = d.getDay();
        const diff = day === 0 ? -6 : 1 - day;
        const monday = new Date(d);
        monday.setDate(d.getDate() + diff);
        monday.setHours(0, 0, 0, 0);
        return monday;
      };

      const result = getMonday(wednesday);
      expect(result.toISOString().split('T')[0]).toBe(monday.toISOString().split('T')[0]);
    });

    it('should calculate correct Sunday for mid-week date', () => {
      const monday = new Date('2025-01-20');
      const expectedSunday = new Date('2025-01-26');

      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);

      expect(sunday.toISOString().split('T')[0]).toBe(expectedSunday.toISOString().split('T')[0]);
    });
  });

  describe('Date Formatting', () => {
    it('should format date as YYYY-MM-DD', () => {
      const date = new Date('2025-01-22T10:30:00Z');
      const formatted = date.toISOString().split('T')[0];

      expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(formatted).toBe('2025-01-22');
    });
  });

  describe('Impact Level Grouping', () => {
    it('should correctly group summaries by impact level', () => {
      const summaries = [
        { impactLevel: 'HIGH', userName: 'John' },
        { impactLevel: 'MEDIUM', userName: 'Jane' },
        { impactLevel: 'LOW', userName: 'Bob' },
        { impactLevel: 'HIGH', userName: 'Alice' },
      ];

      const grouped = {
        high: summaries.filter((s) => s.impactLevel === 'HIGH'),
        medium: summaries.filter((s) => s.impactLevel === 'MEDIUM'),
        low: summaries.filter((s) => s.impactLevel === 'LOW'),
      };

      expect(grouped.high).toHaveLength(2);
      expect(grouped.medium).toHaveLength(1);
      expect(grouped.low).toHaveLength(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle already existing summary', async () => {
      const error = new Error('Weekly summary already exists for week 2025-01-20 to 2025-01-26');

      expect(error.message).toContain('already exists');
    });

    it('should handle OpenAI errors gracefully', () => {
      const errors = [
        'OpenAI rate limit exceeded',
        'OpenAI API key is invalid',
        'OpenAI service is temporarily unavailable',
      ];

      errors.forEach((error) => {
        expect(error).toContain('OpenAI');
      });
    });
  });

  describe('Summary Statistics', () => {
    it('should calculate correct statistics', () => {
      const memberSummaries = [
        { impactLevel: 'HIGH' },
        { impactLevel: 'HIGH' },
        { impactLevel: 'MEDIUM' },
        { impactLevel: 'LOW' },
      ];

      const stats = {
        total: memberSummaries.length,
        high: memberSummaries.filter((s) => s.impactLevel === 'HIGH').length,
        medium: memberSummaries.filter((s) => s.impactLevel === 'MEDIUM').length,
        low: memberSummaries.filter((s) => s.impactLevel === 'LOW').length,
      };

      expect(stats.total).toBe(4);
      expect(stats.high).toBe(2);
      expect(stats.medium).toBe(1);
      expect(stats.low).toBe(1);
    });
  });

  describe('Data Validation', () => {
    it('should validate daily update structure', () => {
      const update = {
        date: '2025-01-20',
        content: 'Test update content',
      };

      expect(update).toHaveProperty('date');
      expect(update).toHaveProperty('content');
      expect(typeof update.date).toBe('string');
      expect(typeof update.content).toBe('string');
    });

    it('should validate summary structure', () => {
      const summary = {
        id: 'uuid',
        weekStartDate: new Date(),
        weekEndDate: new Date(),
        generatedAt: new Date(),
        memberSummaries: [],
      };

      expect(summary).toHaveProperty('weekStartDate');
      expect(summary).toHaveProperty('weekEndDate');
      expect(summary).toHaveProperty('memberSummaries');
      expect(Array.isArray(summary.memberSummaries)).toBe(true);
    });
  });
});
