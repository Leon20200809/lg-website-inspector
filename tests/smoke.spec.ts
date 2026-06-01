/**
 * npm run test:headed -- tests/smoke.spec.ts
 * WEBサイトの必須機能が正常に動作することを確認するのが目的
    ページが開くか	サイトが死んでいないか
    title が取れるか	HTMLが返ってきているか
    h1 があるか	基本構造があるか
    主要要素が見えるか	表示崩壊していないか
 */

import { test, expect } from "@playwright/test";
import { getActiveTargetSites } from "../helpers/target";

const activeSites = getActiveTargetSites();

activeSites.forEach((target_site) => {
  test(`${target_site.name} のトップページが表示できる`, async ({ page }) => {
    await page.goto(target_site.base_url);

    // 現在開いているページの title を取得する
    // デバッグ時に「実際の title が何だったか」を確認したいときに使う
    const title = await page.title();
    console.log(`${target_site.name} の title: ${title}`);

    // expected_title_keywords の配列を「A または B または C」の正規表現に変換する
    // 例: ['LazyGenius', 'Leon', 'Web']
    // → /LazyGenius|Leon|Web/i
    // "i" は大文字・小文字を区別しないという意味
    const titleRegex = new RegExp(
      target_site.expected_title_keywords.join("|"),
      "i",
    );

    await expect(page).toHaveTitle(titleRegex);
  });

  test(`${target_site.name} の"トップページに h1 が存在する"`, async ({ page }) => {
    await page.goto(target_site.base_url);

    const heading = page.locator("h1").first();

    await expect(heading).toBeVisible();
  });
});
