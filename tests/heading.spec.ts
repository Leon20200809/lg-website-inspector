/**
 * h1〜h3の見出し構造を取得し、
 * heading-summary.jsonへ保存する。
 */

import { test, expect } from "@playwright/test";

import { getActiveTargetSites } from "../helpers/target";
import { getSummaryJsonPath, SUMMARY_FILES } from "../helpers/report-paths";
import { saveJsonFile } from "../helpers/json-file";
import { getJapanIsoString } from "../helpers/date";
import {
  applyPageOpenResult,
  openInspectionPage,
} from "../helpers/page-inspection";

import type { HeadingItem, HeadingSummary } from "../types/heading-summary";

import {
  applyHeadingSummary,
  collectHeadingItems,
} from "../inspectors/heading-inspector";

const activeSites = getActiveTargetSites();

activeSites.forEach((targetSite) => {
  test(`${targetSite.name} の見出し構造を収集する`, async ({ page }) => {
    const summaryPath = getSummaryJsonPath(
      targetSite.id,
      SUMMARY_FILES.heading,
    );

    // 検査結果の初期値を作成
    const summary: HeadingSummary = {
      site_id: targetSite.id,
      site_name: targetSite.name,
      base_url: targetSite.base_url,
      page_url: targetSite.base_url,
      inspected_at: getJapanIsoString(),
      inspection_status: "success",
      errors: [],

      total_headings: 0,
      h1_count: 0,
      h2_count: 0,
      h3_count: 0,
      empty_heading_count: 0,
      headings: [],
    };

    try {
      // 検査対象ページを開く
      const response = await openInspectionPage(page, targetSite.base_url);

      // 最終URLとHTTP応答を共通検査結果へ反映する
      applyPageOpenResult(summary, page.url(), response);

      // h1〜h3を取得
      const headings = await collectHeadingItems(page);

      applyHeadingSummary(summary, headings);
    } catch (error: unknown) {
      // 検査失敗を記録
      summary.inspection_status = "failed";

      summary.errors.push(
        error instanceof Error
          ? error.message
          : "見出し構造の収集中に不明なエラーが発生しました",
      );
    } finally {
      // 検査結果をJSONへ保存
      saveJsonFile(summaryPath, summary);

      console.log(`見出し構造JSONを保存しました: ${summaryPath}`);
      console.log(summary);
    }

    expect(summary.inspection_status, summary.errors.join("\n")).not.toBe(
      "failed",
    );
  });
});
