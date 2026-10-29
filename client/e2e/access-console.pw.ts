import { test, expect, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
const enabled = process.env.ACCESS_E2E === "1";
const operatorEmail = process.env.E2E_OPERATOR_EMAIL;
const operatorPassword = process.env.E2E_OPERATOR_PASSWORD;
test("real operator, company activation and tenant credentials stay separated", async ({
  browser,
  baseURL,
}) => {
  test.skip(
    !enabled,
    "Set ACCESS_E2E=1 and provision an operator in an isolated local test database.",
  );
  test.setTimeout(120_000);
  if (!operatorEmail || !operatorPassword)
    throw new Error("Operator test credentials must be securely supplied.");
  if (
    !baseURL ||
    !["127.0.0.1", "localhost"].includes(new URL(baseURL).hostname)
  )
    throw new Error("Access E2E requires an isolated loopback test server.");
  const evidenceDir =
    process.env.ACCESS_EVIDENCE_DIR || "/tmp/ez-access-review";
  await mkdir(evidenceDir, { recursive: true });
  async function capture(page: Page, screen: string) {
    // Raw setup URLs and entered credentials must never appear in evidence.
    // Collapsed security settings may contain empty password inputs. Check
    // booleans so a failed assertion cannot print an entered secret.
    const passwords = page.locator('input[type="password"]');
    expect(
      await passwords.evaluateAll((inputs) =>
        inputs.every((input) => (input as HTMLInputElement).value === ""),
      ),
    ).toBe(true);
    await expect(page.locator('input[type="password"]:visible')).toHaveCount(0);
    await expect(
      page.getByLabel("Owner setup link", { exact: true }),
    ).toHaveCount(0);
    for (const width of [1440, 360]) {
      for (const theme of ["light", "dark"] as const) {
        await page.emulateMedia({
          colorScheme: theme,
          reducedMotion: "reduce",
        });
        await page.evaluate((value) => {
          document.documentElement.classList.toggle("dark", value === "dark");
        }, theme);
        await page.setViewportSize({
          width,
          height: width === 360 ? 900 : 1100,
        });
        await expect
          .poll(() =>
            page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
          )
          .toBe(true);
        await page.locator("main .overflow-y-auto").evaluateAll((elements) =>
          elements.forEach((element) => {
            element.scrollTop = 0;
          }),
        );
        await page.screenshot({
          path: join(evidenceDir, `${screen}-${width}-${theme}.png`),
          fullPage: true,
          animations: "disabled",
        });
      }
    }
    await page.setViewportSize({ width: 1440, height: 1100 });
  }
  const stamp = Date.now().toString();
  const ownerEmail = `owner.${stamp}@example.test`;
  async function localContext() {
    const context = await browser.newContext({ baseURL });
    await context.route("**/*", (route) => {
      const url = new URL(route.request().url());
      return ["localhost", "127.0.0.1"].includes(url.hostname)
        ? route.continue()
        : route.abort();
    });
    return context;
  }
  async function passwordEntry(page: Page, label: string, value: string) {
    try {
      await page.getByLabel(label, { exact: true }).fill(value);
    } catch {
      throw new Error("The local password field was not available.");
    }
  }
  const opContext = await localContext();
  const op = await opContext.newPage();
  const privateReads: string[] = [];
  op.on("request", (request) => {
    if (
      ["/api/console/tenants", "/api/console/audit"].includes(
        new URL(request.url()).pathname,
      )
    )
      privateReads.push(request.method());
  });
  await op.goto("/console/tenants");
  await expect(op.getByLabel("Operator email")).toBeVisible();
  expect(privateReads).toEqual([]);
  await op.getByLabel("Operator email").fill(operatorEmail);
  await passwordEntry(op, "Password", operatorPassword);
  await op.getByRole("button", { name: "Log in to console" }).click();
  await expect(
    op.getByRole("heading", { name: "Company workspaces" }),
  ).toBeVisible();
  // Exercise actual PostgreSQL/session rotation with two independent cookies.
  const otherOpContext = await localContext();
  const otherOp = await otherOpContext.newPage();
  await otherOp.goto("/console/login");
  await otherOp.getByLabel("Operator email").fill(operatorEmail);
  await passwordEntry(otherOp, "Password", operatorPassword);
  await otherOp.getByRole("button", { name: "Log in to console" }).click();
  await expect(
    otherOp.getByRole("heading", { name: "Company workspaces" }),
  ).toBeVisible();
  const rotatedPassword = `Rotation-${randomBytes(20).toString("base64url")}`;
  await op.getByText("Change your password", { exact: true }).click();
  await passwordEntry(op, "Current password", operatorPassword);
  await passwordEntry(op, "New password", rotatedPassword);
  await passwordEntry(op, "Confirm new password", rotatedPassword);
  await op.getByRole("button", { name: "Save new password" }).click();
  await expect(op.getByRole("status")).toContainText("Password changed.");
  expect(
    await op
      .locator('input[type="password"]')
      .evaluateAll((inputs) =>
        inputs.every((input) => (input as HTMLInputElement).value === ""),
      ),
  ).toBe(true);
  await op.getByText("Change your password", { exact: true }).click();
  await otherOp.goto("/console/tenants");
  await expect(otherOp.getByLabel("Operator email")).toBeVisible();
  await otherOp.getByLabel("Operator email").fill(operatorEmail);
  await passwordEntry(otherOp, "Password", operatorPassword);
  await otherOp.getByRole("button", { name: "Log in to console" }).click();
  await expect(otherOp.getByRole("alert")).toContainText(
    "could not be verified",
  );
  await passwordEntry(otherOp, "Password", rotatedPassword);
  await otherOp.getByRole("button", { name: "Log in to console" }).click();
  await expect(
    otherOp.getByRole("heading", { name: "Company workspaces" }),
  ).toBeVisible();
  await otherOpContext.close();
  async function createCompany(suffix: string) {
    await op
      .getByLabel("Company name", { exact: true })
      .fill(`Browser fixture ${stamp} ${suffix}`);
    await op.getByLabel("Owner name", { exact: true }).fill("Fixture Owner");
    await op.getByLabel("Owner email", { exact: true }).fill(ownerEmail);
    await op
      .getByRole("button", { name: "Create company", exact: true })
      .click();
    const link = op.getByLabel("Owner setup link", { exact: true });
    await expect(link).toBeVisible();
    const setup = await link.inputValue();
    const url = new URL(setup);
    expect(url.pathname).toBe("/activate");
    const code = url.searchParams.get("tenantCode") || "";
    expect(code).toMatch(/^[A-Z][0-9]{4}[A-Z]$/);
    await op.getByRole("button", { name: "I have saved the link" }).click();
    return { setup, code };
  }
  const companyA = await createCompany("A");
  const companyB = await createCompany("B");
  expect(companyA.code).not.toBe(companyB.code);
  await capture(op, "console");
  async function activate(page: Page, setup: string, password: string) {
    // Avoid exposing a raw one-use URL in a navigation failure message.
    try {
      await page.goto(setup);
    } catch {
      throw new Error("The local owner activation page did not load.");
    }
    await expect(
      page.getByLabel("New password", { exact: true }),
    ).toBeVisible();
    await expect
      .poll(() => new URL(page.url()).searchParams.has("token"))
      .toBe(false);
    await passwordEntry(page, "New password", password);
    await passwordEntry(page, "Confirm password", password);
    await page
      .getByRole("button", { name: "Set password", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Log in to your workspace" }),
    ).toBeVisible();
  }
  const passwordA = randomBytes(20).toString("base64url");
  const passwordB = randomBytes(20).toString("base64url");
  const contextA = await localContext();
  const a = await contextA.newPage();
  await activate(a, companyA.setup, passwordA);
  const contextB = await localContext();
  const b = await contextB.newPage();
  await activate(b, companyB.setup, passwordB);
  await b.getByLabel("Email address").fill(ownerEmail);
  await passwordEntry(b, "Password", passwordA);
  await b.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(b.getByRole("alert")).toContainText("could not be verified");
  await passwordEntry(b, "Password", passwordB);
  await b.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(b.getByRole("button", { name: "Account menu" })).toBeVisible();
  await a.getByLabel("Email address").fill(ownerEmail);
  await passwordEntry(a, "Password", passwordA);
  await a.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(a.getByRole("button", { name: "Account menu" })).toBeVisible();
  const row = op
    .getByRole("row")
    .filter({ has: op.getByText(companyA.code, { exact: true }) });
  await row.getByRole("button", { name: "Suspend", exact: true }).click();
  await expect(row.getByText("SUSPENDED", { exact: true })).toBeVisible();
  await a.goto("/login");
  await a.getByLabel("Company code").fill(companyA.code);
  await a.getByLabel("Email address").fill(ownerEmail);
  await passwordEntry(a, "Password", passwordA);
  await a.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(a.getByRole("alert")).toContainText("could not be verified");
  await row.getByRole("button", { name: "Resume", exact: true }).click();
  await expect(row.getByText("ACTIVE", { exact: true })).toBeVisible();
  await expect(
    op.getByRole("heading", { name: "Recent audit activity" }),
  ).toBeVisible();
  // The company workspace uses the real authenticated Projects API.
  await b.goto("/app#/projects");
  await expect(
    b.getByRole("heading", { name: "Create a project", exact: true }),
  ).toBeVisible();
  await b
    .getByLabel("Project name", { exact: true })
    .fill(`Delivery project ${stamp}`);
  await b
    .getByLabel("Description", { exact: true })
    .fill("Real API browser verification");
  await b.getByRole("button", { name: "Create project", exact: true }).click();
  await expect(
    b.getByRole("heading", { name: `Delivery project ${stamp}`, exact: true }),
  ).toBeVisible();
  await b.getByLabel("New backlog task").fill("Review the real workflow");
  await b
    .getByRole("button", { name: "Add backlog task", exact: true })
    .click();
  await expect(
    b.getByText("Review the real workflow", { exact: true }),
  ).toBeVisible();
  await capture(b, "projects");
  await b.getByRole("button", { name: "Archive project", exact: true }).click();
  await expect(
    b.getByRole("button", { name: "Restore project", exact: true }),
  ).toBeVisible();
  await b.getByRole("button", { name: "Restore project", exact: true }).click();
  await expect(
    b.getByRole("button", { name: "Archive project", exact: true }),
  ).toBeVisible();
  // Password inputs are empty and masked in this public form screenshot.
  await a.goto("/login");
  await expect(a.getByLabel("Password", { exact: true })).toHaveValue("");
  await a
    .getByLabel("Password", { exact: true })
    .evaluate((element) => element.setAttribute("data-review-mask", "true"));
  for (const width of [360, 1440]) {
    await a.setViewportSize({ width, height: 1000 });
    await expect
      .poll(() =>
        a.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      )
      .toBe(true);
    await a.screenshot({
      path: join(evidenceDir, `login-${width}.png`),
      fullPage: true,
      mask: [a.getByLabel("Password", { exact: true })],
    });
  }
  // Cookies are shared by tabs; document context pins must prevent silent retargeting.
  const stale = await contextB.newPage();
  await stale.goto("/app#/projects");
  await expect(
    stale.getByRole("button", {
      name: new RegExp(`Delivery project ${stamp}`),
    }),
  ).toBeVisible();
  await stale
    .getByLabel("Project name", { exact: true })
    .fill("Stale tab must not create");
  const switched = await contextB.newPage();
  await switched.goto("/login");
  await switched.getByLabel("Company code").fill(companyA.code);
  await switched.getByLabel("Email address").fill(ownerEmail);
  await passwordEntry(switched, "Password", passwordA);
  await switched.getByRole("button", { name: "Log in", exact: true }).click();
  await expect(
    switched.getByRole("button", { name: "Account menu" }),
  ).toBeVisible();
  const rejection = stale.waitForResponse(
    (response) =>
      response.url().endsWith("/api/projects") &&
      response.request().method() === "POST",
  );
  await stale
    .getByRole("button", { name: "Create project", exact: true })
    .click();
  expect((await rejection).status()).toBe(409);
  await expect(
    stale.getByRole("heading", { name: "Your sign-in changed", exact: true }),
  ).toBeVisible();
  await stale.close();
  await switched.close();
  await contextA.close();
  await contextB.close();
  await opContext.close();
});
