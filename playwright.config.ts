import { defineConfig, devices } from "@playwright/test";

/**
 * Playwrightのテスト実行条件を管理する。
 * ブラウザ・並列実行・再試行・レポートなどをここで設定する。
 */

export default defineConfig({
  // tests/ 配下のテストファイルを実行対象にする
  testDir: "./tests",

  // 独立したテストを並列実行する
  fullyParallel: true,

  // CIで test.only の消し忘れがあれば失敗させる
  forbidOnly: Boolean(process.env.CI),

  // CIだけ失敗したテストを2回まで再試行する
  retries: process.env.CI ? 2 : 0,

  // CIでは同時実行数を1に固定し、ローカルでは既定値を使う
  ...(process.env.CI ? { workers: 1 } : {}),

  // 実行結果をHTMLレポートとして出力する
  reporter: "html",

  // 全ブラウザで共通して使う設定
  use: {
    // 再試行が発生した最初の失敗時だけトレースを保存する
    trace: "on-first-retry",
  },

  // test:all で確認するブラウザ
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
  ],
});
