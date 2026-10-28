import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import TenantLogin from "./TenantLogin";
import ConsoleLogin from "./ConsoleLogin";
import ConsoleTenants from "./ConsoleTenants";
import ActivateAccount from "./ActivateAccount";
import { accessApi, AccessError, navigateTo } from "@/lib/access-api";

vi.mock("@/lib/access-api", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/access-api")>(
      "@/lib/access-api",
    );
  return {
    ...actual,
    navigateTo: vi.fn(),
    accessApi: {
      capabilities: vi.fn(),
      login: vi.fn(),
      activate: vi.fn(),
      operatorLogin: vi.fn(),
      operatorMe: vi.fn(),
      operatorLogout: vi.fn(),
      tenants: vi.fn(),
      audit: vi.fn(),
      createTenant: vi.fn(),
      updateTenant: vi.fn(),
      ownerSetup: vi.fn(),
    },
  };
});
const company = {
  id: "tenant-1",
  code: "A0000Z",
  name: "Example team",
  status: "ACTIVE" as const,
  ownerEmail: "owner@example.test",
  ownerName: "Owner",
  storageLimitBytes: 104857600,
  storageBytesUsed: 0,
  seatLimit: 10,
  aiTokenLimit: 0,
  aiTokensUsed: 0,
  createdAt: "2026-10-28T00:00:00Z",
  updatedAt: "2026-10-28T00:00:00Z",
};
const operator = {
  id: "operator-1",
  email: "operator@example.test",
  name: "Operator",
};
const change = (name: string, value: string) =>
  fireEvent.change(screen.getByLabelText(name), { target: { value } });
beforeEach(() => {
  vi.resetAllMocks();
  (
    window as unknown as { happyDOM: { setURL: (url: string) => void } }
  ).happyDOM.setURL("http://localhost:3000/");
  vi.mocked(accessApi.capabilities).mockResolvedValue({
    passwordEnabled: true,
    googleEnabled: false,
  });
  vi.mocked(accessApi.operatorMe).mockResolvedValue({ user: operator });
  vi.mocked(accessApi.tenants).mockResolvedValue([]);
  vi.mocked(accessApi.audit).mockResolvedValue([]);
});

describe("company and operator sign-in", () => {
  it("submits normalized company credentials to the real login boundary before navigating", async () => {
    vi.mocked(accessApi.login).mockResolvedValue({
      tenant: company,
      user: { id: "user-1", name: "Owner", email: "owner@example.test" },
    });
    render(<TenantLogin />);
    change("Company code", "a0000z");
    change("Email address", "owner@example.test");
    change("Password", "A test passphrase");
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));
    await waitFor(() =>
      expect(accessApi.login).toHaveBeenCalledWith({
        tenantCode: "A0000Z",
        email: "owner@example.test",
        password: "A test passphrase",
      }),
    );
    expect(navigateTo).toHaveBeenCalledWith("/app");
  });
  it("keeps failed credentials neutral and does not navigate", async () => {
    vi.mocked(accessApi.login).mockRejectedValue(new AccessError(401));
    render(<TenantLogin />);
    change("Company code", "A0000Z");
    change("Email address", "owner@example.test");
    change("Password", "wrong");
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "could not be verified",
    );
    expect(navigateTo).not.toHaveBeenCalled();
  });
  it("blocks duplicate submissions while the first login is pending", async () => {
    vi.mocked(accessApi.login).mockReturnValue(new Promise(() => {}));
    render(<TenantLogin />);
    change("Company code", "A0000Z");
    change("Email address", "owner@example.test");
    change("Password", "A test passphrase");
    const button = screen.getByRole("button", { name: "Log in" });
    fireEvent.click(button);
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(accessApi.login).toHaveBeenCalledTimes(1);
  });
  it("gates Google on server capability and selected company", async () => {
    vi.mocked(accessApi.capabilities).mockResolvedValue({
      passwordEnabled: true,
      googleEnabled: true,
    });
    render(<TenantLogin />);
    const google = await screen.findByRole("button", {
      name: "Sign in with Google",
    });
    fireEvent.click(google);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Enter your company code",
    );
    expect(navigateTo).not.toHaveBeenCalled();
    change("Company code", "A0000Z");
    fireEvent.click(google);
    expect(navigateTo).toHaveBeenCalledWith(
      "/api/auth/google?tenantCode=A0000Z",
    );
  });
  it("does not advertise disabled Google sign-in", async () => {
    render(<TenantLogin />);
    await waitFor(() => expect(accessApi.capabilities).toHaveBeenCalled());
    expect(
      screen.queryByRole("button", { name: "Sign in with Google" }),
    ).not.toBeInTheDocument();
  });
  it("uses the separate operator endpoint with no tenant selector", async () => {
    vi.mocked(accessApi.operatorLogin).mockResolvedValue({ user: operator });
    render(<ConsoleLogin />);
    expect(screen.queryByLabelText("Company code")).not.toBeInTheDocument();
    change("Operator email", operator.email);
    change("Password", "An operator passphrase");
    fireEvent.click(screen.getByRole("button", { name: "Log in to console" }));
    await waitFor(() =>
      expect(accessApi.operatorLogin).toHaveBeenCalledWith({
        email: operator.email,
        password: "An operator passphrase",
      }),
    );
    expect(navigateTo).toHaveBeenCalledWith("/console/tenants");
  });
});

describe("private console and owner activation", () => {
  it("never fetches tenant or audit data before the operator session is verified", async () => {
    let resolve: ((value: { user: typeof operator }) => void) | undefined;
    vi.mocked(accessApi.operatorMe).mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    render(<ConsoleTenants />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Checking console access",
    );
    expect(accessApi.tenants).not.toHaveBeenCalled();
    expect(accessApi.audit).not.toHaveBeenCalled();
    resolve!({ user: operator });
    await screen.findByText(
      "No companies yet. Create the first company above.",
    );
    expect(accessApi.tenants).toHaveBeenCalledTimes(1);
  });
  it("renders operator login on 401 without fetching private data", async () => {
    vi.mocked(accessApi.operatorMe).mockRejectedValue(new AccessError(401));
    render(<ConsoleTenants />);
    await screen.findByLabelText("Operator email");
    expect(accessApi.tenants).not.toHaveBeenCalled();
    expect(accessApi.audit).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("heading", { name: "Company workspaces" }),
    ).not.toBeInTheDocument();
  });
  it("creates a company with hard defaults and shows the setup link only in the current page", async () => {
    vi.mocked(accessApi.tenants)
      .mockResolvedValueOnce([])
      .mockResolvedValue([company]);
    vi.mocked(accessApi.createTenant).mockResolvedValue({
      data: company,
      setupUrl: "/activate?tenantCode=A0000Z&token=one-use-test-token",
    });
    const page = render(<ConsoleTenants />);
    await screen.findByText(
      "No companies yet. Create the first company above.",
    );
    change("Company name", "Example team");
    change("Owner name", "Owner");
    change("Owner email", "owner@example.test");
    fireEvent.click(screen.getByRole("button", { name: "Create company" }));
    const link = await screen.findByLabelText("Owner setup link");
    expect(accessApi.createTenant).toHaveBeenCalledWith({
      name: "Example team",
      ownerName: "Owner",
      ownerEmail: "owner@example.test",
      storageLimitBytes: 104857600,
      seatLimit: 10,
      aiTokenLimit: 0,
    });
    expect(link).toHaveValue(
      "http://localhost:3000/activate?tenantCode=A0000Z&token=one-use-test-token",
    );
    expect(
      screen.getByRole("button", { name: "Create company" }),
    ).toBeDisabled();
    page.unmount();
    render(<ConsoleTenants />);
    await screen.findByText("owner@example.test");
    expect(screen.queryByLabelText("Owner setup link")).not.toBeInTheDocument();
  });
  it("does not display a data-load error as an empty tenant list", async () => {
    vi.mocked(accessApi.tenants).mockRejectedValue(new AccessError(503));
    render(<ConsoleTenants />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "could not be loaded",
    );
    expect(screen.queryByText("No companies yet.")).not.toBeInTheDocument();
  });
  it("sends suspension to the server rather than mutating only local data", async () => {
    vi.mocked(accessApi.tenants).mockResolvedValue([company]);
    vi.mocked(accessApi.updateTenant).mockResolvedValue({
      ...company,
      status: "SUSPENDED",
    });
    render(<ConsoleTenants />);
    await screen.findByText("owner@example.test");
    fireEvent.click(screen.getByRole("button", { name: "Suspend" }));
    await waitFor(() =>
      expect(accessApi.updateTenant).toHaveBeenCalledWith(company.id, {
        status: "SUSPENDED",
      }),
    );
  });
  it("captures and removes the one-use token, activates, then requires normal login", async () => {
    (
      window as unknown as { happyDOM: { setURL: (url: string) => void } }
    ).happyDOM.setURL(
      "http://localhost:3000/activate?tenantCode=A0000Z&token=activation-test-token",
    );
    vi.mocked(accessApi.activate).mockResolvedValue({
      tenant: company,
      user: { id: "user-1", email: "owner@example.test", name: "Owner" },
    });
    const replace = vi.spyOn(window.history, "replaceState");
    render(<ActivateAccount />);
    // happy-dom does not update location.search for replaceState; verify the
    // real browser API receives a token-free URL. Browser integration checks URL state.
    expect(replace).toHaveBeenCalledWith(
      window.history.state,
      "",
      "/activate?tenantCode=A0000Z",
    );
    replace.mockRestore();
    change("New password", "A safe new passphrase");
    change("Confirm password", "A safe new passphrase");
    fireEvent.click(screen.getByRole("button", { name: "Set password" }));
    await waitFor(() =>
      expect(accessApi.activate).toHaveBeenCalledWith({
        tenantCode: "A0000Z",
        token: "activation-test-token",
        password: "A safe new passphrase",
      }),
    );
    expect(navigateTo).toHaveBeenCalledWith(
      "/login?tenantCode=A0000Z&activated=1",
    );
    expect(accessApi.login).not.toHaveBeenCalled();
  });
  it("rejects a password beyond the bcrypt byte boundary before submitting", () => {
    (
      window as unknown as { happyDOM: { setURL: (url: string) => void } }
    ).happyDOM.setURL(
      "http://localhost:3000/activate?tenantCode=A0000Z&token=activation-test-token",
    );
    render(<ActivateAccount />);
    change("New password", "🔐".repeat(24));
    change("Confirm password", "🔐".repeat(24));
    fireEvent.click(screen.getByRole("button", { name: "Set password" }));
    expect(screen.getByRole("alert")).toHaveTextContent("72 UTF-8 bytes");
    expect(accessApi.activate).not.toHaveBeenCalled();
  });
});

it("requires the server to issue an owner recovery link and describes its shorter lifetime", async () => {
  vi.mocked(accessApi.tenants).mockResolvedValue([company]);
  vi.mocked(accessApi.ownerSetup).mockResolvedValue({
    data: company,
    setupUrl: "/activate?tenantCode=A0000Z&token=one-time-recovery",
    expiresInSeconds: 3600,
  });
  render(<ConsoleTenants />);
  await screen.findByText("owner@example.test");
  fireEvent.click(screen.getByText("Owner account recovery"));
  fireEvent.click(
    screen.getByRole("button", { name: "Issue owner reset link" }),
  );
  await screen.findByLabelText("Owner setup link");
  expect(accessApi.ownerSetup).toHaveBeenCalledWith(company.id);
  expect(
    within(
      screen.getByRole("region", {
        name: "Save the owner setup link for A0000Z",
      }),
    ).getByText(/expires after one hour/),
  ).toBeInTheDocument();
});
it("drops private console data when a privileged operation requires reauthentication", async () => {
  vi.mocked(accessApi.tenants).mockResolvedValue([company]);
  vi.mocked(accessApi.ownerSetup).mockRejectedValue(new AccessError(403));
  render(<ConsoleTenants />);
  await screen.findByText("owner@example.test");
  fireEvent.click(screen.getByText("Owner account recovery"));
  fireEvent.click(
    screen.getByRole("button", { name: "Issue owner reset link" }),
  );
  await screen.findByLabelText("Operator email");
  expect(screen.queryByText("owner@example.test")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Owner setup link")).not.toBeInTheDocument();
});
