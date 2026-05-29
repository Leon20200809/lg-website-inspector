/**
 * WEBサイトの必須機能が正常に動作することを確認するのが目的
    ページが開くか	サイトが死んでいないか
    title が取れるか	HTMLが返ってきているか
    h1 があるか	基本構造があるか
    主要要素が見えるか	表示崩壊していないか
 */

import { test, expect } from "@playwright/test";
import { target_site } from '../helpers/target';

test("トップページが表示できる", async ({ page }) => {
  await page.goto(target_site.base_url);

  await expect(page).toHaveTitle(/LazyGenius|Leon|WordPress|Web/i);
});

test("トップページに h1 が存在する", async ({ page }) => {
  await page.goto(target_site.base_url);

  const heading = page.locator("h1").first();

  await expect(heading).toBeVisible();
});
