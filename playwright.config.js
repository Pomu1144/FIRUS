import { defineConfig, devices } from "@playwright/test";

/**
 * The suite runs against a plain static server - the app has no build step.
 * `CHROMIUM_PATH` lets CI (or a sandbox with a pre-installed browser) point at
 * an existing Chromium instead of downloading one.
 */
const executablePath = process.env.CHROMIUM_PATH || undefined;

export default defineConfig({
  testDir: "./tests",
  timeout: 30000,
  expect: { timeout: 7000 },
  fullyParallel: true,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    launchOptions: executablePath ? { executablePath } : {}
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], launchOptions: executablePath ? { executablePath } : {} } },
    { name: "mobile", use: { ...devices["Pixel 5"], launchOptions: executablePath ? { executablePath } : {} } }
  ],
  webServer: {
    command: "python3 -m http.server 4173 --bind 127.0.0.1",
    url: "http://127.0.0.1:4173/index.html",
    reuseExistingServer: true,
    timeout: 20000
  }
});
