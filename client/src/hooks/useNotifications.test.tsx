import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useNotificationCount, useNotifications } from "./useNotifications";
import { api } from "@/lib/api";
vi.mock("@/lib/api", () => ({ api: { get: vi.fn() } }));
vi.mock("./useUsers", () => ({
  useCurrentUser: () => ({ data: { id: "owner", tenant: { id: "company" } } }),
}));
afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});
it("polls persisted reminders, and count and list observers share an object-shaped cache", async () => {
  vi.mocked(api.get).mockResolvedValueOnce({
    data: { data: { notifications: [], count: 0 } },
  });
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const result = renderHook(
    () => ({ list: useNotifications(), count: useNotificationCount() }),
    { wrapper },
  );
  await waitFor(() =>
    expect(result.result.current.list.data?.notifications).toEqual([]),
  );
  expect(result.result.current.count.data).toBe(0);
  expect(api.get).toHaveBeenCalledTimes(1);
  vi.useFakeTimers();
  vi.mocked(api.get).mockResolvedValue({
    data: {
      data: {
        notifications: [
          { id: "note-reminder", type: "system", title: "Note reminder" },
        ],
        count: 1,
      },
    },
  });
  // Re-mount a polling observer after switching to fake timers.
  result.unmount();
  const polling = renderHook(
    () => ({ list: useNotifications(), count: useNotificationCount() }),
    { wrapper },
  );
  await act(async () => {
    await vi.advanceTimersByTimeAsync(30050);
  });
  expect(polling.result.current.list.data?.notifications[0]?.type).toBe(
    "system",
  );
  expect(polling.result.current.count.data).toBe(1);
  expect(api.get).toHaveBeenCalledTimes(2);
  polling.unmount();
  client.clear();
});
