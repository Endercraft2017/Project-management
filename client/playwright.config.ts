import { defineConfig } from "@playwright/test";
const port = Number(process.env.TOUR_PORT || 5180);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error("Invalid TOUR_PORT");
const externalURL = process.env.TOUR_BASE_URL;
export default defineConfig({
  testDir: "./e2e",
  testMatch: "**/*.pw.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  reporter: "list",
  outputDir: "/tmp/servicebay-tour-test-results",
  use: {
    baseURL: externalURL || `http://127.0.0.1:${port}`,
    browserName: "chromium",
    viewport: { width: 1440, height: 1100 },
    launchOptions: {
      executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined,
    },
  },
  webServer: externalURL
    ? undefined
    : {
        command: `npm run dev -- --host 127.0.0.1 --port ${port} --strictPort`,
        url: `http://127.0.0.1:${port}/tour`,
        reuseExistingServer: false,
        timeout: 30_000,
      },
});
