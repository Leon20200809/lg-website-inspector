/**
 * フォーム・入力項目・ラベル・必須属性を収集する。
 *
 * 外部サイトに対して値の入力やフォーム送信は行わない。
 */

import { test, expect } from "@playwright/test";

import { getActiveTargetSites } from "../helpers/target";
import { getSummaryJsonPath, SUMMARY_FILES } from "../helpers/report-paths";
import { saveJsonFile } from "../helpers/json-file";
import { getJapanIsoString } from "../helpers/date";

import { collectFormItems } from "../inspectors/form-inspector";
import { applyFormSummary } from "../inspectors/form-inspector";

import type { FormItem, FormSummary } from "../types/form-summary";

const targetSites = getActiveTargetSites();

for (const site of targetSites) {
  test(`${site.name} のフォーム情報を収集する`, async ({ page }) => {
    const summary: FormSummary = {
      site_id: site.id,
      site_name: site.name,
      base_url: site.base_url,
      page_url: site.base_url,
      inspected_at: getJapanIsoString(),
      inspection_status: "success",
      errors: [],

      form_found: false,
      total_forms: 0,
      total_fields: 0,
      total_required_fields: 0,
      total_missing_labels: 0,

      // この検査では絶対にフォーム送信を行わない
      form_submit_tested: false,

      forms: [],
    };

    try {
      // 検査対象ページを開き、最初のHTML解析完了まで待つ
      await page.goto(site.base_url, {
        waitUntil: "domcontentloaded",
      });

      // CSS・画像・JavaScriptなど、通常リソースの読込完了を待つ
      await page.waitForLoadState("load");

      // リダイレクト後の実際のページURLを保存する
      summary.page_url = page.url();

      // ページ内に存在するフォームと入力項目の構造を収集する。
      const forms: FormItem[] = await collectFormItems(page);

      // 収集結果をページ全体の集計へ反映する
      applyFormSummary(summary, forms);
    } catch (error) {
      summary.inspection_status = "failed";
      const message = error instanceof Error ? error.message : String(error);
      summary.errors.push(message);
    } finally {
      // 収集結果をJSONに保存する
      const outputPath = getSummaryJsonPath(site.id, SUMMARY_FILES.form);
      await saveJsonFile(outputPath, summary);
    }

    expect(summary.inspection_status, summary.errors.join("\n")).not.toBe(
      "failed",
    );
  });
}
