import { it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { getPaginated } from "@/lib/api";
import { useTasks } from "./useTasks";
vi.mock("@/lib/api", () => ({
  getPaginated: vi.fn(),
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  del: vi.fn(),
}));
it("sends canonical progress filter names to the task request", async () => {
  vi.mocked(getPaginated).mockResolvedValue({
    data: [],
    success: true,
    pagination: { page: 1, limit: 100, total: 0, totalPages: 0 },
  });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const { result } = renderHook(
    () => useTasks({ minProgress: 20, maxProgress: 80 }),
    { wrapper },
  );
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  expect(getPaginated).toHaveBeenCalledWith(
    "/api/tasks",
    expect.objectContaining({ minProgress: 20, maxProgress: 80 }),
  );
  expect(getPaginated).not.toHaveBeenCalledWith(
    "/api/tasks",
    expect.objectContaining({ progressMin: 20 }),
  );
});
