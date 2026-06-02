/**
 * WEBサイトの必須機能が正常に動作することを確認するのが目的
 * npm run test:headed -- tests/smoke.spec.ts
 *
 * ページが開くか      サイトが死んでいないか
 * title が取れるか   HTMLが返ってきているか
 * h1 があるか        基本構造があるか
 *
 * smoke-summary.json を生成し、
 * 将来的なPDFレポート材料として保存する。
 */

import { test, expect } from "@playwright/test";
import { getActiveTargetSites } from "../helpers/target";
import { getSummaryJsonPath, SUMMARY_FILES,} from "../helpers/report-paths";
import { saveJsonFile } from "../helpers/json-file";

const activeSites = getActiveTargetSites();

activeSites.forEach((target_site) => {
  test(`${target_site.name} のトップページ基本情報を確認する`, async ({
    page,
  }) => {
    const summaryPath = getSummaryJsonPath(target_site.id, SUMMARY_FILES.smoke);

    const smokeSummary = {
      site_id: target_site.id,
      site_name: target_site.name,
      base_url: target_site.base_url,
      page_opened: false,
      title_checked: false,
      title_text: "",
      title_matched_keywords: false,
      h1_exists: false,
      h1_text: "",
    };

    const response = await page.goto(target_site.base_url);

    smokeSummary.page_opened = response !== null && response.ok();

    const title = await page.title();

    smokeSummary.title_text = title;
    smokeSummary.title_checked = title.length > 0;

    // expected_title_keywords の配列を「A または B または C」の正規表現に変換する
    // 例: ['LazyGenius', 'Leon', 'Web']
    // → /LazyGenius|Leon|Web/i
    // "i" は大文字・小文字を区別しないという意味
    const titleRegex = new RegExp(
      target_site.expected_title_keywords.join("|"),
      "i",
    );

    smokeSummary.title_matched_keywords = titleRegex.test(title);

    const heading = page.locator("h1").first();
    const headingCount = await page.locator("h1").count();

    smokeSummary.h1_exists = headingCount > 0;

    if (smokeSummary.h1_exists) {
      const h1Text = await heading.textContent();

      smokeSummary.h1_text = h1Text?.trim() || "";
    }

    // スモークテストの検査結果をJSONとして保存する
    saveJsonFile(summaryPath, smokeSummary);

    console.log(`スモーク集計JSONを保存しました: ${summaryPath}`);
    console.log(smokeSummary);

    await expect(page).toHaveTitle(titleRegex);
    await expect(heading).toBeVisible();
  });
});
