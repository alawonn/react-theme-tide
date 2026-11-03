import { defineConfig, devices } from "@playwright/test";

// WebKit needs system libraries that aren't always installed. Opt in with
// TIDE_WEBKIT=1 after `npx playwright install-deps webkit`.
const webkit = process.env.TIDE_WEBKIT === "1";

export default defineConfig({
  testDir: "e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  use: { baseURL: "http://localhost:5179" },
  webServer: {
    command: "npm run demo",
    url: "http://localhost:5179",
    reuseExistingServer: true,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 800 } } },
    { name: "chromium-mobile", use: { ...devices["Pixel 7"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"], viewport: { width: 1280, height: 800 } } },
    { name: "firefox-narrow", use: { ...devices["Desktop Firefox"], viewport: { width: 390, height: 844 } } },
    ...(webkit
      ? [
          { name: "webkit", use: { ...devices["Desktop Safari"], viewport: { width: 1280, height: 800 } } },
          { name: "webkit-iphone", use: { ...devices["iPhone 15"] } },
        ]
      : []),
  ],
});
