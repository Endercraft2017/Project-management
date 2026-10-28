import { expect, it, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { get, post } from "@/lib/api";
import { useGenerateSummary, useSummaryJob } from "./useSummaries";
vi.mock("@/lib/api", () => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  del: vi.fn(),
}));
beforeEach(() => vi.clearAllMocks());
function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const invalidate = vi.spyOn(client, "invalidateQueries");
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { wrapper, invalidate };
}
it("treats202 as job acceptance and refreshes summaries only on DONE", async () => {
  const { wrapper, invalidate } = setup();
  vi.mocked(post).mockResolvedValue({
    jobId: "job1",
    status: "QUEUED",
    weekDate: "2026-10-26",
  });
  const mutation = renderHook(useGenerateSummary, { wrapper });
  await act(async () => {
    await mutation.result.current.mutateAsync("2026-10-28");
  });
  expect(post).toHaveBeenCalledWith("/api/summaries/generate", {
    weekDate: "2026-10-28",
  });
  expect(invalidate).not.toHaveBeenCalled();
  vi.mocked(get).mockResolvedValue({
    id: "job1",
    status: "DONE",
    errorCode: null,
  });
  const job = renderHook(() => useSummaryJob("job1"), { wrapper });
  await waitFor(() => expect(job.result.current.data?.status).toBe("DONE"));
  await waitFor(() =>
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["summaries"] }),
  );
  job.unmount();
  mutation.unmount();
});
it("does not refresh saved summaries after failed generation or retry status errors automatically", async () => {
  const { wrapper, invalidate } = setup();
  vi.mocked(get).mockResolvedValue({
    id: "job2",
    status: "FAILED",
    errorCode: "AI_QUOTA_EXCEEDED",
  });
  const failed = renderHook(() => useSummaryJob("job2"), { wrapper });
  await waitFor(() =>
    expect(failed.result.current.data?.status).toBe("FAILED"),
  );
  expect(invalidate).not.toHaveBeenCalled();
  failed.unmount();
  vi.mocked(get).mockRejectedValue(new Error("Unavailable"));
  const error = renderHook(() => useSummaryJob("job3"), { wrapper });
  await waitFor(() => expect(error.result.current.isError).toBe(true));
  expect(get).toHaveBeenCalledTimes(2);
  error.unmount();
});
