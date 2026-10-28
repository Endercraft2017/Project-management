/** Exercise compiled public login pages on the production Express app, without Vite or credentials. */
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { existsSync } from "node:fs";
import path from "node:path";
const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(path.join(root, "package.json"));
const raw = process.env.TEST_DATABASE_URL;
assert(
  raw,
  "TEST_DATABASE_URL must identify a dedicated disposable local database",
);
const url = new URL(raw);
assert(["postgres:", "postgresql:"].includes(url.protocol));
assert(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname));
assert(
  /^[a-z0-9_]+_test$/i.test(url.pathname.slice(1)) &&
    !url.searchParams.has("schema"),
);
assert(
  existsSync(path.join(root, "client/dist/index.html")),
  "Build the complete repository before this check",
);
process.env.DATABASE_URL = raw;
process.env.NODE_ENV = "production";
process.env.SESSION_SECRET = randomBytes(48).toString("hex");
process.env.CONSOLE_SESSION_SECRET = randomBytes(48).toString("hex");
process.env.AI_ENABLED = "false";
process.env.MAIL_ENABLED = "false";
const server = createServer(
  require(path.join(root, "server/dist/app.js")).default,
);
let browser;
let passed = 0;
async function check(name, fn) {
  await fn();
  passed++;
  console.log(`PASS ${name}`);
}
try {
  await new Promise((done, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", done);
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const { chromium } = require("playwright");
  browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
      : {}),
  });
  const context = await browser.newContext();
  await context.route("**/*", (route) =>
    new URL(route.request().url()).origin === base
      ? route.continue()
      : route.abort(),
  );
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  async function nativeForm() {
    await page.getByLabel("Company code", { exact: true }).waitFor();
    assert(await page.getByLabel("Email address", { exact: true }).isVisible());
    assert(await page.getByLabel("Password", { exact: true }).isVisible());
    assert.equal(
      await page.getByRole("button", { name: "Sign in with Google" }).count(),
      0,
    );
  }
  await check(
    "compiled production login presents native company credentials",
    async () => {
      const response = await page.goto(`${base}/login`, {
        waitUntil: "networkidle",
      });
      assert.equal(response.status(), 200);
      await nativeForm();
      assert.equal(response.headers()["cache-control"], "no-store");
    },
  );
  await check(
    "old Google browser links arrive at the native compiled form",
    async () => {
      await page.goto(
        `${base}/api/auth/google?returnTo=https://untrusted.example`,
        { waitUntil: "networkidle" },
      );
      assert.equal(page.url(), `${base}/login?error=google_disabled`);
      await nativeForm();
      assert(
        (await page.getByRole("alert").textContent()).includes(
          "company code, email and password",
        ),
      );
    },
  );
  await check(
    "old OAuth callback data is discarded rather than echoed into login",
    async () => {
      await page.goto(
        `${base}/api/auth/google/callback?code=synthetic-code&state=synthetic-state`,
        { waitUntil: "networkidle" },
      );
      assert.equal(page.url(), `${base}/login?error=google_disabled`);
      await nativeForm();
    },
  );
  await check("API requests retain disabled capability JSON", async () => {
    const response = await context.request.get(`${base}/api/auth/google`, {
      headers: { Accept: "application/json" },
      maxRedirects: 0,
    });
    assert.equal(response.status(), 503);
    assert.equal((await response.json()).error, "CAPABILITY_DISABLED");
    assert.equal(response.headers().location, undefined);
  });
  await check(
    "direct index documents cannot cache the old sign-in shell",
    async () => {
      const response = await context.request.get(`${base}/index.html`);
      assert.equal(response.status(), 200);
      assert.equal(response.headers()["cache-control"], "no-store");
      assert((await response.text()).includes("/assets/"));
    },
  );
  await check(
    "capabilities match the rendered login without Google configuration",
    async () => {
      const response = await context.request.get(
        `${base}/api/auth/capabilities`,
      );
      const data = await response.json();
      assert.equal(data.passwordEnabled, true);
      assert.equal(data.googleEnabled, false);
    },
  );
  console.log(
    JSON.stringify({
      passed,
      failed: 0,
      frontend: "compiled production assets",
      externalCalls: 0,
    }),
  );
} catch (error) {
  console.error(`Compiled login verification failed: ${error.message}`);
  process.exitCode = 1;
} finally {
  await browser?.close();
  await new Promise((done) => server.close(() => done()));
  await require(
    path.join(root, "server/dist/middlewares/session.js"),
  ).closeSessionStore();
  await require(
    path.join(root, "server/dist/database/client.js"),
  ).disconnectPrisma();
  await require(
    path.join(root, "server/dist/platform/pool.js"),
  ).closeControlPool();
}
