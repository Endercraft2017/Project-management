import { test, expect } from "@playwright/test";

test("manual navigation, slide accessibility and preserved app entry", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/tour");
  await expect(
    page.getByRole("heading", { name: "Less scattered. More in sync." }),
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
  await expect(
    page.getByRole("link", { name: "Sign in with Google" }),
  ).toHaveAttribute("href", "/api/auth/google");
  await page.getByRole("link", { name: "Explore the product tour" }).click();
  await expect(
    page.getByRole("heading", { name: "Less scattered. More in sync." }),
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
  await page.getByRole("link", { name: "Open the app", exact: true }).focus();
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
        page.getByRole("link", { name: "Open the app", exact: true }),
      ).toBeVisible();
    }
  }
});

test("failed interactive chunk keeps readable product context and app navigation", async ({
  page,
}) => {
  await page.route("**/src/pages/ProductTour.tsx", (route) => route.abort());
  await page.goto("/tour");
  await expect(
    page.getByText("The interactive preview could not load.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Open the app", exact: true }),
  ).toHaveAttribute("href", "/");
  await expect(
    page.getByRole("link", { name: "Reload preview" }),
  ).toHaveAttribute("href", "/tour");
});
