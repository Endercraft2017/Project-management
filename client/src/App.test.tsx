import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import App from "./App";
import { useCurrentUser } from "@/hooks/useUsers";
import api from "@/lib/api";
vi.mock("@/hooks/useUsers", () => ({ useCurrentUser: vi.fn() }));
vi.mock("@/lib/socket", () => ({
  initializeSocket: vi.fn(),
  connectSocket: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
}));
vi.mock("@/components/tasks/TaskTree", () => ({
  default: () => <div data-testid="task-tree">Task Tree</div>,
}));
vi.mock("@/components/summary/SummaryView", () => ({
  default: () => <div data-testid="summary-view">Summary View</div>,
}));
vi.mock("@/components/chat/NotificationPanel", () => ({
  default: () => <button>Notifications</button>,
}));
vi.mock("@/components/invites/InviteUserDialog", () => ({
  default: () => null,
}));
vi.mock("@/components/admin/AdminSettingsModal", () => ({
  default: () => null,
}));
vi.mock("@/lib/api", () => ({
  default: { post: vi.fn().mockResolvedValue({}) },
}));
vi.mock("@/lib/access-api", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/access-api")>(
      "@/lib/access-api",
    );
  return {
    ...actual,
    accessApi: {
      capabilities: vi
        .fn()
        .mockResolvedValue({ passwordEnabled: true, googleEnabled: false }),
    },
  };
});
const member = {
  id: "1",
  email: "member@example.test",
  name: "Test User",
  role: "MEMBER",
  picture: null,
};
function session(
  data: typeof member | null = null,
  overrides: Record<string, unknown> = {},
) {
  vi.mocked(useCurrentUser).mockReturnValue({
    data,
    isLoading: false,
    isError: !data,
    error: !data ? { response: { status: 401 } } : null,
    refetch: vi.fn(),
    ...overrides,
  } as unknown as ReturnType<typeof useCurrentUser>);
  return render(<App />);
}
beforeEach(() => {
  vi.clearAllMocks();
  (
    window as unknown as { happyDOM: { setURL: (url: string) => void } }
  ).happyDOM.setURL("http://localhost:3000/");
});
describe("workspace session boundary", () => {
  it("shows company credentials for an unauthenticated session", () => {
    session();
    expect(screen.getByLabelText("Company code")).toBeInTheDocument();
    expect(screen.getByLabelText("Email address")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toHaveAttribute(
      "autocomplete",
      "current-password",
    );
    expect(screen.queryByTestId("summary-view")).not.toBeInTheDocument();
  });
  it("offers retry rather than sign-in when the service fails", () => {
    const refetch = vi.fn();
    session(null, { error: { response: { status: 503 } }, refetch });
    expect(
      screen.getByRole("heading", {
        name: "Your workspace could not be reached",
      }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Company code")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry connection" }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });
  it("does not confuse a network error with an expired session", () => {
    session(null, { error: new Error("Network disconnected") });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "connection or service issue",
    );
    expect(
      screen.queryByRole("button", { name: "Log in" }),
    ).not.toBeInTheDocument();
  });
  it("shows loading while checking the session", () => {
    session(null, { isLoading: true, isError: false });
    expect(screen.getByRole("status")).toHaveTextContent("Loading");
    expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
  });
  it("keeps public product navigation available on login", () => {
    session();
    expect(
      screen.getByRole("link", { name: "Explore the product tour" }),
    ).toHaveAttribute("href", "/");
  });
  it("explains a failed provider callback without claiming success", () => {
    (
      window as unknown as { happyDOM: { setURL: (url: string) => void } }
    ).happyDOM.setURL("http://localhost:3000/login?error=auth_failed");
    session();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Sign-in did not complete",
    );
  });
});
describe("authenticated application wiring", () => {
  it("renders the real app shell after session verification", async () => {
    session(member);
    expect(screen.getByText("Test User")).toBeInTheDocument();
    expect(screen.queryByLabelText("Company code")).not.toBeInTheDocument();
    expect(await screen.findByTestId("summary-view")).toBeInTheDocument();
  });
  it("uses POST for sign-out", async () => {
    session(member);
    fireEvent.keyDown(screen.getByRole("button", { name: "Account menu" }), {
      key: "Enter",
    });
    fireEvent.click(screen.getByRole("menuitem", { name: "Sign out" }));
    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith("/api/auth/logout"),
    );
  });
  it("opens dashboard then changes the view and URL", async () => {
    session(member);
    await screen.findByTestId("summary-view");
    fireEvent.click(screen.getAllByRole("button", { name: /^Tasks$/ })[0]);
    expect(await screen.findByTestId("task-tree")).toBeInTheDocument();
    expect(window.location.hash).toBe("#/tasks");
  });
  it("restores a task deep link", async () => {
    window.location.hash = "#/tasks";
    session(member);
    expect(await screen.findByTestId("task-tree")).toBeInTheDocument();
  });
  it("hides and rejects the admin view for members", async () => {
    window.location.hash = "#/team";
    session(member);
    expect(
      screen.queryByRole("button", { name: /^Team$/ }),
    ).not.toBeInTheDocument();
    expect(await screen.findByTestId("summary-view")).toBeInTheDocument();
  });
  it("shows admin navigation only to the returned admin principal", () => {
    session({ ...member, role: "ADMIN" });
    expect(
      screen.getAllByRole("button", { name: /^Team$/ }).length,
    ).toBeGreaterThan(0);
  });
});
