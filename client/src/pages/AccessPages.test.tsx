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
      operatorMfa: vi.fn(),
      verifyOperatorMfa: vi.fn(),
      operatorMe: vi.fn(),
      operatorLogout: vi.fn(),
      changeOperatorPassword: vi.fn(),
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
async function workspaceReady() {
  await screen.findByRole("heading", {
    name: "Company workspaces",
  });
  await waitFor(() => expect(accessApi.tenants).toHaveBeenCalled());
}
async function openCreateCompany() {
  await workspaceReady();
  const createButton = screen.getByRole("button", {
    name: "Create company",
  });
  await waitFor(() => expect(createButton).toBeEnabled());
  fireEvent.click(createButton);
  return await screen.findByRole("dialog", { name: "Create a company" });
}
async function openCompanyManagement() {
  fireEvent.click(
    await screen.findByRole("button", {
      name: `Manage ${company.name}`,
    }),
  );
  return await screen.findByRole("dialog");
}
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
  vi.mocked(accessApi.operatorMfa).mockResolvedValue({
    configured: false,
    enabled: false,
  });
  vi.mocked(accessApi.tenants).mockResolvedValue([]);
  vi.mocked(accessApi.audit).mockResolvedValue([]);
});

describe("company and operator sign-in", () => {
  it("explains the native sign-in path after a legacy Google link", async () => {
    window.history.replaceState({}, "", "/login?error=google_disabled");
    render(<TenantLogin />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Use your company code, email and password",
    );
    expect(screen.getByLabelText("Company code")).toBeVisible();
    await waitFor(() => expect(accessApi.capabilities).toHaveBeenCalled());
    expect(
      screen.queryByRole("button", { name: "Sign in with Google" }),
    ).not.toBeInTheDocument();
  });

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
  it("reveals and hides the operator password without changing its value or password-manager hint", () => {
    render(<ConsoleLogin />);
    const password = screen.getByLabelText("Password");
    change("Password", "Visibility test passphrase");
    expect(password).toHaveAttribute("type", "password");
    expect(password).toHaveAttribute("autocomplete", "current-password");
    const show = screen.getByRole("button", { name: "Show password" });
    expect(show).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(show);
    expect(password).toHaveAttribute("type", "text");
    expect(password).toHaveValue("Visibility test passphrase");
    expect(password).toHaveAttribute("autocomplete", "current-password");
    const hide = screen.getByRole("button", { name: "Hide password" });
    expect(hide).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(hide);
    expect(password).toHaveAttribute("type", "password");
    expect(password).toHaveValue("Visibility test passphrase");
    expect(accessApi.operatorLogin).not.toHaveBeenCalled();
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
    await workspaceReady();
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
    const dialog = await openCreateCompany();
    change("Company name", "Example team");
    change("Owner name", "Owner");
    change("Owner email", "owner@example.test");
    fireEvent.click(
      within(dialog).getByRole("button", {
        name: "Create company",
      }),
    );
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
      /could not be loaded/,
    );
    expect(screen.queryByText(/No companies yet/)).not.toBeInTheDocument();
  });
  it("sends suspension to the server rather than mutating only local data", async () => {
    vi.mocked(accessApi.tenants).mockResolvedValue([company]);
    vi.mocked(accessApi.updateTenant).mockResolvedValue({
      ...company,
      status: "SUSPENDED",
    });
    render(<ConsoleTenants />);
    await openCompanyManagement();
    fireEvent.click(screen.getByRole("button", { name: "Suspend" }));
    expect(accessApi.updateTenant).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Confirm suspension" }));
    await waitFor(() =>
      expect(accessApi.updateTenant).toHaveBeenCalledWith(company.id, {
        status: "SUSPENDED",
      }),
    );
  });
  it("allows operators to change an existing company's account-slot cap", async () => {
    vi.mocked(accessApi.tenants).mockResolvedValue([company]);
    vi.mocked(accessApi.updateTenant).mockResolvedValue({
      ...company,
      seatLimit: 20,
    });
    render(<ConsoleTenants />);
    await openCompanyManagement();
    fireEvent.click(screen.getByText("Manage limits"));
    const limit = screen.getByLabelText("Account slot limit");
    expect(limit).toHaveValue(10);
    expect(limit).toHaveAccessibleDescription(/active and pending accounts/);
    fireEvent.change(limit, { target: { value: "20" } });
    fireEvent.click(screen.getByRole("button", { name: "Save limits" }));
    await waitFor(() =>
      expect(accessApi.updateTenant).toHaveBeenCalledWith(company.id, {
        name: company.name,
        storageLimitBytes: company.storageLimitBytes,
        aiTokenLimit: company.aiTokenLimit,
        seatLimit: 20,
      }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Company settings saved.",
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
  await openCompanyManagement();
  fireEvent.click(screen.getByText("Owner account recovery"));
  fireEvent.click(
    screen.getByRole("button", { name: "Issue owner reset link" }),
  );
  expect(accessApi.ownerSetup).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Confirm owner reset" }));
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
  vi.mocked(accessApi.ownerSetup).mockRejectedValue(
    new AccessError(403, "OPERATOR_REAUTH_REQUIRED"),
  );
  render(<ConsoleTenants />);
  await openCompanyManagement();
  fireEvent.click(screen.getByText("Owner account recovery"));
  fireEvent.click(
    screen.getByRole("button", { name: "Issue owner reset link" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Confirm owner reset" }));
  await screen.findByLabelText("Operator email");
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Sign in again before issuing an owner recovery link. No reset link has been issued.",
  );
  expect(screen.queryByText("owner@example.test")).not.toBeInTheDocument();
  expect(screen.queryByLabelText("Owner setup link")).not.toBeInTheDocument();
});

describe("operator workspace workflows", () => {
  it("filters all loaded companies and paginates ten at a time", async () => {
    const companies = Array.from({ length: 12 }, (_, index) => ({
      ...company,
      id: `tenant-${index + 1}`,
      code: `A${String(index + 1).padStart(4, "0")}Z`,
      name: `Team ${String(index + 1).padStart(2, "0")}`,
      ownerEmail: `owner${index + 1}@example.test`,
      status: index % 4 === 0 ? ("SUSPENDED" as const) : ("ACTIVE" as const),
    }));
    vi.mocked(accessApi.tenants).mockResolvedValue(companies);
    render(<ConsoleTenants />);
    await screen.findByRole("button", { name: "Next company page" });
    expect(
      screen.getAllByRole("button", { name: /^Manage Team / }),
    ).toHaveLength(10);
    fireEvent.click(screen.getByRole("button", { name: "Next company page" }));
    expect(
      screen.getAllByRole("button", { name: /^Manage Team / }),
    ).toHaveLength(2);
    change("Search companies", "owner12@example.test");
    expect(
      screen.getByRole("button", { name: "Manage Team 12" }),
    ).toBeVisible();
    expect(
      screen.getAllByRole("button", { name: /^Manage Team / }),
    ).toHaveLength(1);
    change("Search companies", "");
    change("Company status", "SUSPENDED");
    expect(
      screen.getAllByRole("button", { name: /^Manage Team / }),
    ).toHaveLength(3);
    change("Search companies", "does not exist");
    expect(
      screen.getByRole("heading", { name: "No companies match" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("heading", { name: "No companies yet" }),
    ).not.toBeInTheDocument();
    expect(accessApi.tenants).toHaveBeenCalledTimes(1);
  });

  it("cancels suspension without changing company access", async () => {
    vi.mocked(accessApi.tenants).mockResolvedValue([company]);
    render(<ConsoleTenants />);
    await openCompanyManagement();
    fireEvent.click(screen.getByRole("button", { name: "Suspend" }));
    expect(
      screen.getByRole("button", { name: "Confirm suspension" }),
    ).toBeVisible();
    expect(accessApi.updateTenant).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", { name: "Cancel confirmation" }),
    );
    expect(accessApi.updateTenant).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("button", { name: "Confirm suspension" }),
    ).not.toBeInTheDocument();
  });

  it("cancels owner recovery without invalidating any setup links", async () => {
    vi.mocked(accessApi.tenants).mockResolvedValue([company]);
    render(<ConsoleTenants />);
    await openCompanyManagement();
    fireEvent.click(screen.getByText("Owner account recovery"));
    fireEvent.click(
      screen.getByRole("button", { name: "Issue owner reset link" }),
    );
    expect(
      screen.getByRole("button", { name: "Confirm owner reset" }),
    ).toBeVisible();
    expect(accessApi.ownerSetup).not.toHaveBeenCalled();
    fireEvent.click(
      screen.getByRole("button", { name: "Cancel confirmation" }),
    );
    expect(accessApi.ownerSetup).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Owner setup link")).not.toBeInTheDocument();
  });

  it("retains the creation draft when the dialog is canceled", async () => {
    render(<ConsoleTenants />);
    const dialog = await openCreateCompany();
    change("Company name", "Draft company");
    change("Owner name", "Draft owner");
    change("Owner email", "draft@example.test");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(
      screen.queryByRole("dialog", { name: "Create a company" }),
    ).not.toBeInTheDocument();
    expect(accessApi.createTenant).not.toHaveBeenCalled();
    await openCreateCompany();
    expect(screen.getByLabelText("Company name")).toHaveValue("Draft company");
    expect(screen.getByLabelText("Owner name")).toHaveValue("Draft owner");
    expect(screen.getByLabelText("Owner email")).toHaveValue(
      "draft@example.test",
    );
  });

  it("keeps company management and account security available when activity fails", async () => {
    vi.mocked(accessApi.tenants).mockResolvedValue([company]);
    vi.mocked(accessApi.audit).mockRejectedValue(new AccessError(503));
    render(<ConsoleTenants />);
    const manage = await screen.findByRole("button", {
      name: `Manage ${company.name}`,
    });
    expect(manage).toBeEnabled();
    fireEvent.click(manage);
    expect(screen.getByRole("button", { name: "Suspend" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Close dialog" }));
    fireEvent.click(screen.getByRole("button", { name: "Account security" }));
    fireEvent.click(screen.getByText("Change your password"));
    expect(screen.getByLabelText("Current password")).toBeEnabled();
    expect(
      screen.getByRole("button", { name: "Save new password" }),
    ).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Activity" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /could not be loaded/,
    );
    expect(
      screen.queryByRole("heading", { name: "No activity recorded yet" }),
    ).not.toBeInTheDocument();
  });
});

describe("operator password changes", () => {
  async function openPasswordForm() {
    vi.mocked(accessApi.tenants).mockResolvedValue([company]);
    render(<ConsoleTenants />);
    await workspaceReady();
    fireEvent.click(screen.getByRole("button", { name: "Account security" }));
    fireEvent.click(screen.getByText("Change your password"));
    change("Current password", "Current operator passphrase");
    change("New password", "New unique operator passphrase");
    change("Confirm new password", "New unique operator passphrase");
  }

  it("blocks navigation and duplicate changes until the password request finishes", async () => {
    let finish: (() => void) | undefined;
    vi.mocked(accessApi.changeOperatorPassword).mockReturnValue(
      new Promise((resolve) => {
        finish = () => resolve({ success: true });
      }),
    );
    await openPasswordForm();
    fireEvent.click(screen.getByRole("button", { name: "Save new password" }));
    expect(accessApi.changeOperatorPassword).toHaveBeenCalledTimes(1);
    for (const name of [
      "Workspaces",
      "Activity",
      "Account security",
      "Log out",
    ]) {
      expect(screen.getByRole("button", { name })).toBeDisabled();
    }
    const pending = screen.getByRole("button", { name: "Changing password…" });
    expect(pending).toBeDisabled();
    fireEvent.click(pending);
    expect(accessApi.changeOperatorPassword).toHaveBeenCalledTimes(1);
    finish!();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Workspaces" })).toBeEnabled(),
    );
    expect(screen.getByLabelText("Current password")).toHaveValue("");
  });

  it("preserves an unsent password-change draft while switching console views", async () => {
    await openPasswordForm();
    fireEvent.click(screen.getByRole("button", { name: "Workspaces" }));
    expect(
      screen.getByRole("heading", { name: "Company workspaces" }),
    ).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Account security" }));
    expect(screen.getByLabelText("Current password")).toHaveValue(
      "Current operator passphrase",
    );
    expect(screen.getByLabelText("New password")).toHaveValue(
      "New unique operator passphrase",
    );
    expect(screen.getByLabelText("Confirm new password")).toHaveValue(
      "New unique operator passphrase",
    );
    expect(accessApi.changeOperatorPassword).not.toHaveBeenCalled();
  });

  it("submits a confirmed password change and clears password fields", async () => {
    vi.mocked(accessApi.changeOperatorPassword).mockResolvedValue({
      success: true,
    });
    await openPasswordForm();
    fireEvent.click(screen.getByRole("button", { name: "Save new password" }));
    await waitFor(() =>
      expect(accessApi.changeOperatorPassword).toHaveBeenCalledWith({
        currentPassword: "Current operator passphrase",
        newPassword: "New unique operator passphrase",
      }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Password changed. Your other operator sessions have been signed out.",
    );
    expect(screen.getByLabelText("Current password")).toHaveValue("");
    expect(screen.getByLabelText("New password")).toHaveValue("");
    expect(screen.getByLabelText("Confirm new password")).toHaveValue("");
  });

  it("blocks mismatched new passwords before making a request", async () => {
    await openPasswordForm();
    change("Confirm new password", "Different operator passphrase");
    fireEvent.click(screen.getByRole("button", { name: "Save new password" }));
    expect(screen.getByRole("alert")).toHaveTextContent("do not match");
    expect(accessApi.changeOperatorPassword).not.toHaveBeenCalled();
  });

  it("keeps the console available after an incorrect current password", async () => {
    vi.mocked(accessApi.changeOperatorPassword).mockRejectedValue(
      new AccessError(403, "CURRENT_PASSWORD_INVALID"),
    );
    await openPasswordForm();
    fireEvent.click(screen.getByRole("button", { name: "Save new password" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Your current password could not be verified",
    );
    expect(
      screen.getByRole("heading", { name: "Operator account security" }),
    ).toBeVisible();
    expect(screen.queryByLabelText("Operator email")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Current password")).toHaveValue("");
  });

  it("explains when the password changed but the renewed session failed", async () => {
    vi.mocked(accessApi.changeOperatorPassword).mockRejectedValue(
      new AccessError(503, "PASSWORD_CHANGED_SIGN_IN_REQUIRED"),
    );
    await openPasswordForm();
    fireEvent.click(screen.getByRole("button", { name: "Save new password" }));
    await screen.findByLabelText("Operator email");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Your password was changed. Sign in again using your new password.",
    );
    expect(screen.queryByText("owner@example.test")).not.toBeInTheDocument();
    expect(navigateTo).not.toHaveBeenCalled();
  });
});
