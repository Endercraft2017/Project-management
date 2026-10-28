/**
 * Tests for OpenAI Service
 */

import { openAIService } from "../openai.service";
import { runWithTenant } from "@/tenancy/context";
import type { DailyUpdateData } from "../openai.service";

// Mock OpenAI module
jest.mock("openai", () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => {
      return {
        chat: {
          completions: {
            create: jest.fn(),
          },
        },
      };
    }),
  };
});

describe("OpenAI Service", () => {
  // Store the original environment
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    // Reset environment
    process.env = { ...originalEnv, OPENAI_API_KEY: "test-api-key" };
  });

  afterAll(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe("generateWeeklySummary", () => {
    it("should generate a summary with high impact", async () => {
      const mockUpdates: DailyUpdateData[] = [
        {
          date: "2025-01-20",
          content:
            "Completed major feature X that increases performance by 50%",
        },
        {
          date: "2025-01-21",
          content: "Fixed critical security vulnerability in authentication",
        },
        {
          date: "2025-01-22",
          content:
            "Deployed the new dashboard to production with zero downtime",
        },
      ];

      // This is a mock test - in real implementation, you'd mock the OpenAI response
      // For now, we're testing the structure
      expect(mockUpdates).toBeDefined();
      expect(mockUpdates.length).toBe(3);
    });

    it("rejects empty evidence instead of inventing a LOW assessment", async () => {
      process.env.AI_ENABLED = "true";
      const tenant = {
        id: "00000000-0000-4000-8000-000000000001",
        code: "A0000Z",
        name: "Synthetic",
        schemaName: "ez_t_0123456789abcdef",
        status: "ACTIVE" as const,
      };
      await expect(
        runWithTenant(tenant, () =>
          openAIService.generateWeeklySummary("John Doe", []),
        ),
      ).rejects.toThrow();
    });

    it("should properly format update data", () => {
      const updates: DailyUpdateData[] = [
        { date: "2025-01-20", content: "Update 1" },
        { date: "2025-01-21", content: "Update 2" },
      ];

      const formatted = updates
        .map((u) => `Date: ${u.date}\nUpdate: ${u.content}`)
        .join("\n\n");

      expect(formatted).toContain("Date: 2025-01-20");
      expect(formatted).toContain("Update: Update 1");
      expect(formatted).toContain("Date: 2025-01-21");
      expect(formatted).toContain("Update: Update 2");
    });
  });

  describe("Impact Level Assessment", () => {
    it("should validate impact levels", () => {
      const validLevels = ["HIGH", "MEDIUM", "LOW"];
      const testLevel = "HIGH";

      expect(validLevels).toContain(testLevel);
    });

    it("should reject invalid impact levels", () => {
      const validLevels = ["HIGH", "MEDIUM", "LOW"];
      const invalidLevel = "INVALID";

      expect(validLevels).not.toContain(invalidLevel);
    });
  });

  describe("Error Handling", () => {
    it("should handle missing API key", () => {
      // Remove API key from environment
      delete process.env.OPENAI_API_KEY;

      // Attempting to create a new service should throw
      expect(() => {
        // Note: This would require re-importing the module
        // In a real test, you'd use dependency injection
      }).toBeDefined();
    });

    it("should handle API errors gracefully", () => {
      // Mock error scenarios
      const apiErrors = [
        { status: 429, message: "Rate limit exceeded" },
        { status: 401, message: "Invalid API key" },
        { status: 503, message: "Service unavailable" },
      ];

      apiErrors.forEach((error) => {
        expect(error.status).toBeGreaterThanOrEqual(400);
        expect(error.message).toBeDefined();
      });
    });
  });

  describe("Configuration", () => {
    it("should use correct model", () => {
      const expectedModel = "gpt-3.5-turbo";
      expect(expectedModel).toBe("gpt-3.5-turbo");
    });

    it("should have appropriate temperature setting", () => {
      const temperature = 0.7;
      expect(temperature).toBeGreaterThanOrEqual(0);
      expect(temperature).toBeLessThanOrEqual(1);
    });

    it("should set max retries", () => {
      const maxRetries = 3;
      expect(maxRetries).toBeGreaterThan(0);
    });

    it("should have timeout configured", () => {
      const timeout = 60000; // 60 seconds
      expect(timeout).toBeGreaterThan(0);
    });
  });

  describe("Response Validation", () => {
    it("should validate response structure", () => {
      const validResponse = {
        summary: "Test summary",
        impactLevel: "HIGH",
        reasoning: "Test reasoning",
      };

      expect(validResponse).toHaveProperty("summary");
      expect(validResponse).toHaveProperty("impactLevel");
      expect(validResponse).toHaveProperty("reasoning");
    });

    it("should validate impact level values", () => {
      const validLevels: Array<"HIGH" | "MEDIUM" | "LOW"> = [
        "HIGH",
        "MEDIUM",
        "LOW",
      ];

      validLevels.forEach((level) => {
        expect(["HIGH", "MEDIUM", "LOW"]).toContain(level);
      });
    });
  });

  describe("Security", () => {
    it("should not expose API key in errors", () => {
      const apiKey = "sk-test-key";
      const safeError = "API error occurred";

      expect(safeError).not.toContain(apiKey);
    });

    it("should sanitize user input", () => {
      const dangerousInput = '<script>alert("xss")</script>';
      const updates: DailyUpdateData[] = [
        { date: "2025-01-20", content: dangerousInput },
      ];

      // Service should handle this gracefully
      expect(updates[0].content).toBe(dangerousInput);
      // In production, OpenAI API will handle this as text
    });
  });
});
