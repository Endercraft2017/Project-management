import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";

const operator = {
  id: "fixture-operator",
  name: "Platform operator",
  email: "operator@example.test",
};
function fixtures() {
  return Array.from({ length: 23 }, (_, i) => ({
    id: `fixture-${i}`,
    code: `A${String(i).padStart(4, "0")}Z`,
    name:
      i === 0
        ? "Northstar Studio"
        : i === 1
          ? "Harbor Collective"
          : `Studio ${String(i + 1).padStart(2, "0")}`,
    ownerName: `Workspace owner ${i + 1}`,
    ownerEmail: `owner${i + 1}@example.test`,
    status:
      i === 1
        ? "SUSPENDED"
        : i === 2
          ? "FAILED"
          : i === 3
            ? "PROVISIONING"
            : "ACTIVE",
    storageLimitBytes: 104857600,
    storageBytesUsed: i * 1024 * 1024,
    seatLimit: 10,
    aiTokenLimit: 0,
    aiTokensUsed: 0,
    createdAt: new Date(Date.UTC(2026, 9, 29 - i)).toISOString(),
    updatedAt: new Date(Date.UTC(2026, 9, 29 - i)).toISOString(),
  }));
}
async function mockConsole(
  page: Page,
  baseURL: string | undefined,
  options: {
    auditError?: boolean;
    tenantError?: boolean;
    empty?: boolean;
  } = {},
) {
  if (
    !baseURL ||
    !["127.0.0.1", "localhost"].includes(new URL(baseURL).hostname)
  )
    throw Error("Console fixtures require a local test server");
  const origin = new URL(baseURL).origin;
  let companies = options.empty ? [] : fixtures();
  const writes: { path: string; body: Record<string, unknown> }[] = [];
  const events = Array.from({ length: 24 }, (_, i) => ({
    id: `event-${i}`,
    tenantId: i % 3 === 0 ? null : `fixture-${i % 23}`,
    operatorId: operator.id,
    action: i % 2 ? "tenant.created" : "tenant.updated",
    detail: {},
    createdAt: new Date(Date.UTC(2026, 9, 29, 12, 0) - i * 60000).toISOString(),
  }));
  await page.route("**/*", async (route) => {
    const request = route.request(),
      url = new URL(request.url());
    if (url.origin !== origin) return route.abort();
    if (!url.pathname.startsWith("/api/")) return route.continue();
    let status = 200,
      data: Record<string, unknown> = { success: true };
    const path = url.pathname,
      method = request.method();
    if (path === "/api/console/me") data = { success: true, user: operator };
    else if (path === "/api/console/mfa")
      data = { success: true, configured: true, enabled: false };
    else if (path === "/api/console/audit") {
      status = options.auditError ? 503 : 200;
      data = { success: status === 200, data: events };
    } else if (path === "/api/console/tenants" && method === "GET") {
      status = options.tenantError ? 503 : 200;
      data = { success: status === 200, data: companies };
    } else if (path === "/api/console/tenants" && method === "POST") {
      const input = request.postDataJSON();
      writes.push({ path, body: input });
      const company = {
        ...fixtures()[0],
        ...input,
        id: "new-fixture",
        code: "N0023Z",
        storageBytesUsed: 0,
      };
      companies = [company, ...companies];
      data = {
        success: true,
        data: company,
        setupUrl: "/activate?tenantCode=N0023Z&token=synthetic-test-link",
      };
    } else if (path.startsWith("/api/console/tenants/") && method === "PATCH") {
      const input = request.postDataJSON();
      writes.push({ path, body: input });
      const id = path.split("/").pop();
      companies = companies.map((company) =>
        company.id === id ? { ...company, ...input } : company,
      );
      data = {
        success: true,
        data: companies.find((company) => company.id === id),
      };
    } else if (path.endsWith("/owner-setup")) {
      writes.push({ path, body: {} });
      data = {
        success: true,
        data: companies[0],
        setupUrl: `/activate?tenantCode=${companies[0].code}&token=synthetic-recovery`,
        expiresInSeconds: 3600,
      };
    } else if (path === "/api/console/logout") data = { success: true };
    else {
      status = 404;
      data = { success: false };
    }
    await route.fulfill({ status, json: data });
  });
  await page.goto("/console/tenants");
  await expect(
    page.getByRole("heading", { name: "Company workspaces", exact: true }),
  ).toBeVisible();
  return { writes };
}
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
}
async function audit(page: Page, name: string) {
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    result.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      targets: v.nodes.map((n) => n.target),
    })),
    name,
  ).toEqual([]);
}

test("directory search, status filters, sorting, and pagination", async ({
  page,
  baseURL,
}) => {
  await mockConsole(page, baseURL);
  await expect(
    page.getByRole("button", { name: "Manage Northstar Studio", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Next company page" }).click();
  await expect(
    page.getByRole("button", { name: "Manage Studio 11", exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Search companies", { exact: true })
    .fill("owner1@example.test");
  await expect(
    page.getByRole("button", { name: "Manage Northstar Studio", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Next company page" }),
  ).toBeDisabled();
  await page.getByLabel("Search companies", { exact: true }).fill("");
  await page
    .getByLabel("Company status", { exact: true })
    .selectOption("SUSPENDED");
  await expect(
    page.getByRole("button", { name: "Manage Harbor Collective", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Manage Northstar Studio", exact: true }),
  ).toHaveCount(0);
  await page.getByLabel("Company status", { exact: true }).selectOption("all");
  await page.getByLabel("Sort companies", { exact: true }).selectOption("name");
  await page
    .getByLabel("Search companies", { exact: true })
    .fill("not-found-fixture");
  await expect(
    page.getByText("No companies match", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear company filters" }).click();
  await expect(
    page.getByRole("button", { name: "Manage Harbor Collective", exact: true }),
  ).toBeVisible();
});

test("creation preserves its draft and protects the one-use setup link across views", async ({
  page,
  baseURL,
}) => {
  const { writes } = await mockConsole(page, baseURL, { empty: true });
  await page
    .getByRole("button", { name: "Create company", exact: true })
    .click();
  let dialog = page.getByRole("dialog", {
    name: "Create a company",
    exact: true,
  });
  await expect(
    dialog.getByLabel("Company name", { exact: true }),
  ).toBeFocused();
  await dialog.getByLabel("Company name", { exact: true }).fill("Cedar Works");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  expect(writes).toHaveLength(0);
  await page
    .getByRole("button", { name: "Create company", exact: true })
    .click();
  dialog = page.getByRole("dialog", { name: "Create a company", exact: true });
  await expect(dialog.getByLabel("Company name", { exact: true })).toHaveValue(
    "Cedar Works",
  );
  await dialog.getByLabel("Owner name", { exact: true }).fill("Cedar Owner");
  await dialog
    .getByLabel("Owner email", { exact: true })
    .fill("cedar@example.test");
  await dialog
    .getByRole("button", { name: "Create company", exact: true })
    .click();
  await expect(
    page.getByLabel("Owner setup link", { exact: true }),
  ).toBeVisible();
  expect(writes).toHaveLength(1);
  expect(writes[0].body).toMatchObject({
    seatLimit: 10,
    storageLimitBytes: 104857600,
    aiTokenLimit: 0,
  });
  await page
    .getByRole("button", { name: "Account security", exact: true })
    .click();
  await expect(
    page.getByLabel("Owner setup link", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Workspaces", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Create company", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "I have saved the link", exact: true })
    .click();
  await expect(
    page.getByLabel("Owner setup link", { exact: true }),
  ).toHaveCount(0);
});

test("access changes require an explicit company confirmation", async ({
  page,
  baseURL,
}) => {
  const { writes } = await mockConsole(page, baseURL);
  await page
    .getByRole("button", { name: "Manage Northstar Studio", exact: true })
    .click();
  await page.getByRole("button", { name: "Suspend", exact: true }).click();
  await expect(page.getByRole("dialog", { name: /Suspend/ })).toBeVisible();
  expect(writes).toHaveLength(0);
  await page
    .getByRole("button", { name: "Cancel confirmation", exact: true })
    .click();
  expect(writes).toHaveLength(0);
  await page.getByRole("button", { name: "Suspend", exact: true }).click();
  await page
    .getByRole("button", { name: "Confirm suspension", exact: true })
    .click();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0].body).toEqual({ status: "SUSPENDED" });
});

test("audit failure leaves workspaces and account security usable", async ({
  page,
  baseURL,
}) => {
  await mockConsole(page, baseURL, { auditError: true });
  await expect(
    page.getByRole("button", { name: "Create company", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Activity", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("could not be loaded");
  await page
    .getByRole("button", { name: "Account security", exact: true })
    .click();
  await page.getByText("Change your password", { exact: true }).click();
  await expect(
    page.getByLabel("Current password", { exact: true }),
  ).toBeEnabled();
});

test("responsive console and dialogs pass automated accessibility checks", async ({
  page,
  baseURL,
}) => {
  await mockConsole(page, baseURL);
  const evidence = process.env.CONSOLE_EVIDENCE_DIR || "/tmp/ez-console-review";
  await mkdir(evidence, { recursive: true });
  for (const width of [1440, 768, 360]) {
    await page.setViewportSize({ width, height: width === 360 ? 900 : 1000 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await noOverflow(page);
    await audit(page, `directory-${width}`);
    await page.screenshot({
      path: join(evidence, `workspaces-${width}.png`),
      fullPage: true,
    });
  }
  await page
    .getByRole("button", { name: "Manage Northstar Studio", exact: true })
    .click();
  await noOverflow(page);
  await audit(page, "company-details-mobile");
  await page.screenshot({
    path: join(evidence, "company-details-360.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page
    .getByRole("button", { name: "Create company", exact: true })
    .click();
  await noOverflow(page);
  await audit(page, "create-company-mobile");
  await page.screenshot({
    path: join(evidence, "create-company-360.png"),
    fullPage: true,
  });
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("button", { name: "Activity", exact: true }).click();
  await audit(page, "activity");
  await page.screenshot({
    path: join(evidence, "activity-1440.png"),
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Account security", exact: true })
    .click();
  await audit(page, "security");
  await page.screenshot({
    path: join(evidence, "security-1440.png"),
    fullPage: true,
  });
});

test("unsaved company limits survive confirmation and require explicit discard", async ({
  page,
  baseURL,
}) => {
  const { writes } = await mockConsole(page, baseURL);
  await page
    .getByRole("button", { name: "Manage Northstar Studio", exact: true })
    .click();
  await page.getByText("Manage limits", { exact: true }).click();
  await page.getByLabel("Account slot limit", { exact: true }).fill("20");
  await page.getByRole("button", { name: "Suspend", exact: true }).click();
  await audit(page, "suspension-confirmation");
  await page
    .getByRole("button", { name: "Cancel confirmation", exact: true })
    .click();
  await expect(
    page.getByLabel("Account slot limit", { exact: true }),
  ).toHaveValue("20");
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await expect(
    page.getByRole("dialog", { name: "Discard unsaved changes?", exact: true }),
  ).toBeVisible();
  await audit(page, "discard-confirmation");
  await page.getByRole("button", { name: "Keep editing", exact: true }).click();
  await expect(
    page.getByLabel("Account slot limit", { exact: true }),
  ).toHaveValue("20");
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page
    .getByRole("button", { name: "Discard changes", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(writes).toHaveLength(0);
  await page
    .getByRole("button", { name: "Manage Northstar Studio", exact: true })
    .click();
  await page.getByText("Manage limits", { exact: true }).click();
  await expect(
    page.getByLabel("Account slot limit", { exact: true }),
  ).toHaveValue("10");
});
