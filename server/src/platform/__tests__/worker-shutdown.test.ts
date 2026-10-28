import prisma from "../../database/client";
import { weeklySummariesService } from "../../summaries/service";
import { runWorker, executeJob } from "../worker";
import { listTenants, getTenantById } from "../store";
import { claimJob, forgetWorker, touchWorker } from "../jobs";
jest.mock("../store", () => ({
  listTenants: jest.fn(),
  getTenantById: jest.fn(),
}));
jest.mock("../jobs", () => ({
  claimJob: jest.fn(),
  touchWorker: jest.fn(),
  forgetWorker: jest.fn(),
  completeJob: jest.fn(),
  enqueueJob: jest.fn(),
  failJob: jest.fn(),
  renewJob: jest.fn(),
}));
jest.mock("../../database/client", () => ({
  __esModule: true,
  default: { user: { findFirst: jest.fn() } },
}));
jest.mock("../../summaries/service", () => ({
  weeklySummariesService: { generateWeeklySummary: jest.fn() },
}));
const original = process.env.WORKER_ENABLED;
beforeEach(() => {
  jest.clearAllMocks();
  process.env.WORKER_ENABLED = "true";
  (forgetWorker as jest.Mock).mockResolvedValue(undefined);
  (touchWorker as jest.Mock).mockResolvedValue(undefined);
});
afterEach(() => {
  if (original === undefined) delete process.env.WORKER_ENABLED;
  else process.env.WORKER_ENABLED = original;
});
it("does not claim another job when shutdown arrives during schedule scanning", async () => {
  const stop = new AbortController();
  (listTenants as jest.Mock).mockImplementation(async () => {
    stop.abort();
    return [];
  });
  await runWorker(stop.signal);
  expect(claimJob).not.toHaveBeenCalled();
  expect(forgetWorker).toHaveBeenCalledTimes(1);
});
it("does not advertise or claim work when already stopping", async () => {
  const stop = new AbortController();
  stop.abort();
  await runWorker(stop.signal);
  expect(listTenants).not.toHaveBeenCalled();
  expect(claimJob).not.toHaveBeenCalled();
  expect(forgetWorker).not.toHaveBeenCalled();
});
it("rejects malformed stored JSON before tenant lookup or side effects", async () => {
  const job = {
    id: "job",
    tenantId: "tenant",
    kind: "weekly_summary_email" as const,
    payload: null as unknown as Record<string, unknown>,
    attempts: 1,
    maxAttempts: 1,
    leaseOwner: "worker",
  };
  await expect(executeJob(job)).rejects.toMatchObject({
    code: "INVALID_JOB_PAYLOAD",
  });
  expect(getTenantById).not.toHaveBeenCalled();
});

it("keeps readiness alive during a long initial scan and stops the scan heartbeat on exit", async () => {
  jest.useFakeTimers();
  const stop = new AbortController();
  let finishScan: (value: never[]) => void = () => {};
  (listTenants as jest.Mock).mockImplementation(
    () =>
      new Promise((resolve) => {
        finishScan = resolve;
      }),
  );
  try {
    const running = runWorker(stop.signal);
    await Promise.resolve();
    await Promise.resolve();
    expect(touchWorker).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(20000);
    expect(touchWorker).toHaveBeenCalledTimes(2);
    stop.abort();
    finishScan([]);
    await running;
    const count = (touchWorker as jest.Mock).mock.calls.length;
    await jest.advanceTimersByTimeAsync(60000);
    expect(touchWorker).toHaveBeenCalledTimes(count);
    expect(claimJob).not.toHaveBeenCalled();
    expect(forgetWorker).toHaveBeenCalledTimes(1);
  } finally {
    jest.useRealTimers();
  }
});

const summaryTenant = {
  id: "00000000-0000-4000-8000-000000000001",
  code: "A0000Z",
  name: "Synthetic",
  schemaName: "ez_t_0123456789abcdef",
  status: "ACTIVE",
};
const summaryJob = {
  id: "job",
  tenantId: summaryTenant.id,
  kind: "summary_generate" as const,
  payload: { weekDate: "2026-10-26", actorId: "admin" },
  attempts: 1,
  maxAttempts: 1,
  leaseOwner: "worker",
};
it("generates only within the selected active tenant after rechecking admin authority", async () => {
  (getTenantById as jest.Mock).mockResolvedValue(summaryTenant);
  (prisma.user.findFirst as jest.Mock).mockResolvedValue({ id: "admin" });
  (weeklySummariesService.generateWeeklySummary as jest.Mock).mockResolvedValue(
    { id: "summary" },
  );
  await executeJob(summaryJob);
  expect(prisma.user.findFirst).toHaveBeenCalledWith({
    where: { id: "admin", isActive: true, role: "ADMIN" },
    select: { id: true },
  });
  expect(weeklySummariesService.generateWeeklySummary).toHaveBeenCalledWith(
    new Date("2026-10-26T12:00:00Z"),
  );
});
it("does not generate after the requesting administrator is revoked", async () => {
  (getTenantById as jest.Mock).mockResolvedValue(summaryTenant);
  (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);
  await expect(executeJob(summaryJob)).rejects.toMatchObject({
    code: "JOB_ACTOR_FORBIDDEN",
  });
  expect(weeklySummariesService.generateWeeklySummary).not.toHaveBeenCalled();
});
it("rejects noncanonical dates before any paid generation", async () => {
  (getTenantById as jest.Mock).mockResolvedValue(summaryTenant);
  await expect(
    executeJob({
      ...summaryJob,
      payload: { ...summaryJob.payload, weekDate: "2026-10-25" },
    }),
  ).rejects.toMatchObject({ code: "INVALID_JOB_PAYLOAD" });
  expect(weeklySummariesService.generateWeeklySummary).not.toHaveBeenCalled();
});
