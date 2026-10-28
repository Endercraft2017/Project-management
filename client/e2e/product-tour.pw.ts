import { test, expect } from "@playwright/test";

// These are frontend route/carousel tests, not authentication integration tests.
// The separate access-console journey uses the real backend and no auth intercepts.
test.beforeEach(async ({ page }) => {
  await page.route("**/api/auth/me", (route) =>
    route.fulfill({
      status: 401,
      json: { success: false },
      headers: {
        "access-control-allow-origin": new URL(page.url()).origin,
        "access-control-allow-credentials": "true",
      },
    }),
  );
  await page.route("**/api/auth/capabilities", (route) =>
    route.fulfill({
      json: { success: true, passwordEnabled: true, googleEnabled: false },
      headers: {
        "access-control-allow-origin": new URL(page.url()).origin,
        "access-control-allow-credentials": "true",
      },
    }),
  );
});

test("manual navigation, slide accessibility and preserved app entry", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/tour");
  await expect(
    page.getByRole("heading", { name: "Skip the basic." }),
  ).toBeVisible();
  const position = page.locator(".tour-position b");
  await expect(position).toHaveText("01");
  await expect(
    page.getByRole("button", { name: "Previous preview", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Next preview", exact: true }).click();
  await expect(position).toHaveText("02");
  await page
    .getByRole("button", { name: "Previous preview", exact: true })
    .click();
  await expect(position).toHaveText("01");
  await page
    .getByRole("button", { name: "Show preview 3", exact: true })
    .click();
  await expect(position).toHaveText("03");
  await expect(page.locator(".swiper-slide[inert]")).toHaveCount(3);
  await page
    .getByRole("button", { name: "Previous preview", exact: true })
    .focus();
  await page.keyboard.press("ArrowLeft");
  await expect(position).toHaveText("02");
  await page.goto("/");
  await page.getByRole("link", { name: "Log in", exact: true }).first().click();
  await expect(
    page.getByRole("textbox", { name: "Company code" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Explore the product tour" }).click();
  await expect(
    page.getByRole("heading", { name: "Skip the basic." }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("explicit play, durable pause, final-slide stop and focus-entry stop", async ({
  page,
}) => {
  await page.goto("/tour");
  const position = page.locator(".tour-position b");
  await expect(position).toHaveText("01");
  await page.waitForTimeout(6700);
  await expect(position).toHaveText("01");
  await page
    .getByRole("button", { name: "Show preview 3", exact: true })
    .click();
  await page.getByRole("button", { name: "Play tour", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Pause tour", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Pause tour", exact: true }).click();
  await page.mouse.move(0, 0);
  await page.waitForTimeout(6700);
  await expect(position).toHaveText("03");
  await page.getByRole("button", { name: "Play tour", exact: true }).click();
  await expect(position).toHaveText("04", { timeout: 8000 });
  await expect(
    page.getByRole("button", { name: "Play tour", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".tour-position")).toHaveAttribute(
    "aria-live",
    "polite",
  );
  await page.getByRole("button", { name: "Play tour", exact: true }).click();
  await expect(position).toHaveText("01");
  await page.getByRole("link", { name: "Log in", exact: true }).first().focus();
  await page.getByRole("button", { name: "Pause tour", exact: true }).focus();
  await expect(
    page.getByRole("button", { name: "Play tour", exact: true }),
  ).toBeVisible();
});

test("reduced motion keeps the active slide and responsive pages do not overflow", async ({
  page,
}) => {
  await page.goto("/tour");
  await page
    .getByRole("button", { name: "Show preview 3", exact: true })
    .click();
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(
    page.getByRole("button", { name: "Play tour", exact: true }),
  ).toBeDisabled();
  await expect(page.locator(".tour-position b")).toHaveText("03");
  await page.getByRole("button", { name: "Next preview", exact: true }).click();
  await expect(page.locator(".tour-position b")).toHaveText("04");
  for (const width of [360, 768, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const dark of [false, true]) {
      await page.evaluate(
        (enabled) => document.documentElement.classList.toggle("dark", enabled),
        dark,
      );
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth > window.innerWidth,
        ),
      ).toBe(false);
      await expect(
        page.getByRole("button", { name: "Previous preview", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: "Log in", exact: true }).first(),
      ).toBeVisible();
    }
  }
});

test("failed interactive chunk keeps readable product context and app navigation", async ({
  page,
}) => {
  await page.route(
    (url) => /\/(?:ProductTour\.tsx|ProductTour-[^/]+\.js)$/.test(url.pathname),
    (route) => route.abort(),
  );
  await page.goto("/tour");
  await expect(
    page.getByText("The interactive preview could not load.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Log in", exact: true }),
  ).toHaveAttribute("href", "/login");
  await expect(
    page.getByRole("link", { name: "Reload preview" }),
  ).toHaveAttribute("href", "/tour");
});

test("E-Z public root has correct contact, login and actual-screen assets", async ({
  page,
}) => {
  const apiRequests: string[] = [];
  const sdkRequests: string[] = [];
  page.on("request", (request) => {
    if (
      /^https:\/\/(apis.google.com|accounts.google.com)\//.test(request.url())
    )
      sdkRequests.push(request.url());
    if (new URL(request.url()).pathname.startsWith("/api/"))
      apiRequests.push(request.url());
  });
  await page.goto("/");
  await expect(page).toHaveTitle("E-Z — Skip the basic");
  await expect(
    page.getByRole("heading", { name: "Skip the basic." }),
  ).toBeVisible();
  await expect(page.getByText("E-Z · IN DEVELOPMENT")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Talk to us", exact: false }).first(),
  ).toHaveAttribute("href", "https://afkcube.com/contact");
  await expect(
    page.getByRole("link", { name: "Log in", exact: true }).first(),
  ).toHaveAttribute("href", "/login");
  await expect(page.locator(".tour-wordmark img")).toHaveAttribute(
    "src",
    "/brand/ez-logo.webp",
  );
  for (let number = 1; number <= 4; number++) {
    await page
      .getByRole("button", { name: `Show preview ${number}`, exact: true })
      .click();
    const image = page.locator(".swiper-slide-active .tour-preview img");
    await expect(image).toBeVisible();
    await expect
      .poll(() =>
        image.evaluate(
          (element: HTMLImageElement) =>
            element.complete && element.naturalWidth > 0,
        ),
      )
      .toBe(true);
    await expect(
      page.locator(".swiper-slide-active figcaption > span"),
    ).toHaveText("Demo data · actual application UI");
    const fullSize = page.locator(".swiper-slide-active figcaption a");
    await expect(fullSize).toHaveAttribute(
      "href",
      (await image.getAttribute("src")) || "",
    );
    await expect(fullSize).toHaveAttribute("target", "_blank");
    if (number === 1) {
      const [popup] = await Promise.all([
        page.waitForEvent("popup"),
        fullSize.click(),
      ]);
      await popup.waitForLoadState();
      expect(popup.url()).toContain("/screens/ez-tasks-demo.png");
      await popup.close();
    }
  }
  expect(apiRequests).toEqual([]);
  expect(sdkRequests).toEqual([]);
  for (const route of ["/login", "/app", "/?view=updates", "/#/tasks"]) {
    await page.goto(route);
    await expect(
      page.getByRole("textbox", { name: "Company code" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Skip the basic." }),
    ).toHaveCount(0);
  }
});

test("legacy root invite links still reach the invitation flow", async ({
  page,
}) => {
  await page.route("**/api/invites/validate?token=*", (route) =>
    route.fulfill({
      status: 410,
      json: { success: false },
      headers: {
        "access-control-allow-origin": new URL(page.url()).origin,
        "access-control-allow-credentials": "true",
      },
    }),
  );
  await page.goto("/?token=demo-expired-invitation");
  await expect(
    page.getByRole("heading", { name: "Invalid Invitation" }),
  ).toBeVisible();
  await expect(page.getByText("Invalid invitation token")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Skip the basic." }),
  ).toHaveCount(0);
});
