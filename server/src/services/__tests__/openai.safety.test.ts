import { getTenantById } from "@/platform/store";
import OpenAI from "openai";
import { openAIService } from "../openai.service";
import { runWithTenant } from "@/tenancy/context";
import { reserveAIUsage, settleAIUsage, UsageError } from "@/platform/usage";
jest.mock("openai", () => ({ __esModule: true, default: jest.fn() }));
jest.mock("@/platform/usage", () => ({
  ...jest.requireActual("@/platform/usage"),
  reserveAIUsage: jest.fn(),
  settleAIUsage: jest.fn(),
}));
jest.mock("@/platform/store", () => ({ getTenantById: jest.fn() }));
const tenant = {
  id: "00000000-0000-4000-8000-000000000001",
  code: "A0000Z",
  name: "Synthetic",
  schemaName: "ez_t_0123456789abcdef",
  status: "ACTIVE" as const,
};
const updates = [{ date: "2026-10-28", content: "Synthetic completed task" }];
const env = process.env;
let create: jest.Mock;
beforeEach(() => {
  jest.clearAllMocks();
  process.env = {
    ...env,
    AI_ENABLED: "true",
    OPENAI_API_KEY: "synthetic-not-a-live-key",
  };
  create = jest.fn();
  (OpenAI as unknown as jest.Mock).mockImplementation(() => ({
    chat: { completions: { create } },
  }));
  (reserveAIUsage as jest.Mock).mockResolvedValue({
    id: "reservation",
    tenantId: tenant.id,
    reservedTokens: 1000,
  });
  (settleAIUsage as jest.Mock).mockResolvedValue(undefined);
});
afterEach(() => {
  process.env = env;
});
const generate = (items = updates) =>
  runWithTenant(tenant, () =>
    openAIService.generateWeeklySummary("Member", items),
  );
it("does not construct or call provider when globally disabled", async () => {
  process.env.AI_ENABLED = "false";
  await expect(generate()).rejects.toMatchObject({ code: "AI_DISABLED" });
  expect(OpenAI).not.toHaveBeenCalled();
  expect(reserveAIUsage).not.toHaveBeenCalled();
});
it("does not construct or call provider when tenant has no allowance", async () => {
  (reserveAIUsage as jest.Mock).mockRejectedValue(
    new UsageError("quota", "AI_QUOTA_EXCEEDED"),
  );
  await expect(generate()).rejects.toMatchObject({ code: "AI_QUOTA_EXCEEDED" });
  expect(OpenAI).not.toHaveBeenCalled();
});
it("bounds input before reserving or constructing provider", async () => {
  await expect(
    generate([{ date: "2026-10-28", content: "x".repeat(8001) }]),
  ).rejects.toThrow();
  expect(reserveAIUsage).not.toHaveBeenCalled();
  expect(OpenAI).not.toHaveBeenCalled();
});
it("validates response and settles usage with no retries", async () => {
  create.mockResolvedValue({
    usage: { total_tokens: 80 },
    choices: [
      {
        finish_reason: "stop",
        message: {
          content: JSON.stringify({
            summary: "Completed the task.",
            impactLevel: "MEDIUM",
            reasoning: "Evidence in updates.",
          }),
        },
      },
    ],
  });
  const result = await generate();
  expect(result.impact.level).toBe("MEDIUM");
  expect(OpenAI).toHaveBeenCalledWith(
    expect.objectContaining({ maxRetries: 0, timeout: 20000 }),
  );
  expect(create).toHaveBeenCalledWith(
    expect.objectContaining({ max_tokens: 500 }),
  );
  expect(settleAIUsage).toHaveBeenCalledWith(expect.anything(), 80);
});
it("does not manufacture LOW assessment for invalid provider output", async () => {
  create.mockResolvedValue({
    usage: { total_tokens: 80 },
    choices: [
      { finish_reason: "stop", message: { content: '{"summary":"wrong"}' } },
    ],
  });
  await expect(generate()).rejects.toMatchObject({
    code: "AI_GENERATION_FAILED",
  });
  expect(settleAIUsage).toHaveBeenCalledWith(expect.anything(), 80);
});
it("retains conservative reservation for uncertain provider failure", async () => {
  create.mockRejectedValue(new Error("provider failed with private content"));
  await expect(generate()).rejects.toMatchObject({
    code: "AI_GENERATION_FAILED",
  });
  expect(create).toHaveBeenCalledTimes(1);
  expect(settleAIUsage).toHaveBeenCalledWith(expect.anything(), undefined);
});

it("reports disabled and exhausted quota without constructing a provider", async () => {
  (getTenantById as jest.Mock).mockResolvedValue({
    ...tenant,
    aiTokenLimit: 100,
    aiTokensUsed: 100,
  });
  const exhausted = await runWithTenant(tenant, () =>
    openAIService.getAvailability(),
  );
  expect(exhausted).toMatchObject({
    enabled: true,
    canGenerate: false,
    reason: "AI_QUOTA_EXCEEDED",
    tokensRemaining: 0,
  });
  process.env.AI_ENABLED = "false";
  const disabled = await runWithTenant(tenant, () =>
    openAIService.getAvailability(),
  );
  expect(disabled.reason).toBe("AI_DISABLED");
  expect(OpenAI).not.toHaveBeenCalled();
  expect(reserveAIUsage).not.toHaveBeenCalled();
});
