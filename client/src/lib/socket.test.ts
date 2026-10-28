import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const transport = vi.hoisted(() => ({
  io: vi.fn(),
  on: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
}));
vi.mock("socket.io-client", () => ({ io: transport.io }));
beforeEach(() => {
  vi.resetModules();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
  transport.io.mockReturnValue(transport);
});
afterEach(() => {
  vi.unstubAllEnvs();
});
describe("cookie-authenticated realtime origin", () => {
  it("prefers the explicit socket origin over an API origin", async () => {
    vi.stubEnv("VITE_SOCKET_URL", "https://realtime.example.invalid");
    vi.stubEnv("VITE_API_URL", "https://api.example.invalid");
    const { initializeSocket } = await import("./socket");
    initializeSocket();
    expect(transport.io).toHaveBeenCalledWith(
      "https://realtime.example.invalid",
      expect.objectContaining({ withCredentials: true }),
    );
  });
  it("defaults to the current browser origin so Vite can proxy cookie requests", async () => {
    vi.stubEnv("VITE_SOCKET_URL", "");
    vi.stubEnv("VITE_API_URL", "");
    const { initializeSocket } = await import("./socket");
    initializeSocket();
    expect(transport.io).toHaveBeenCalledWith(
      window.location.origin,
      expect.objectContaining({ withCredentials: true, autoConnect: false }),
    );
  });
  it("uses the explicit API origin without query or local-storage credentials", async () => {
    vi.stubEnv("VITE_SOCKET_URL", "");
    vi.stubEnv("VITE_API_URL", "https://api.example.invalid");
    const { initializeSocket } = await import("./socket");
    initializeSocket();
    expect(transport.io).toHaveBeenCalledWith(
      "https://api.example.invalid",
      expect.objectContaining({
        withCredentials: true,
        transports: ["websocket", "polling"],
        autoConnect: false,
      }),
    );
  });
});
