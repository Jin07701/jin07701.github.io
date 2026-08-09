import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 3100);
const BASE_URL = `http://127.0.0.1:${PORT}`;

/**
 * §38 の必須テストをブラウザ操作で回すための設定。
 *
 * webServer は本番ビルドを起動する。next build / next start は NODE_ENV=production を前提とするため、
 * 開発用の NODE_ENV が環境に残っていても production で上書きする。
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    locale: "ja-JP",
    timezoneId: "Asia/Tokyo",
  },
  projects: [
    {
      name: "mobile",
      use: {
        ...devices["Pixel 7"],
        // スマホの実機ブラウザに近い条件で見る(§36 スマホファースト)。
        launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
          ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
          : {},
      },
    },
  ],
  webServer: {
    command: `npm run start -- --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { NODE_ENV: "production", NEXT_PUBLIC_BASE_URL: BASE_URL },
  },
});
