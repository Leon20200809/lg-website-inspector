/**
 * title・meta description・canonical・langを取得し、
 * meta-summary.jsonへ保存する。
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

import { collectMetaInfo } from "../inspectors/meta-inspector";

import type { MetaSummary } from "../types/meta-summary";

const activeSites = getActiveTargetSites();

activeSites.forEach((targetSite) => {
  test(`${targetSite.name} のメタ情報を収集する`, async ({ page }) => {
    const summaryPath = getSummaryJsonPath(targetSite.id, SUMMARY_FILES.meta);

    // 検査結果の初期値を作成
    const summary: MetaSummary = {
      site_id: targetSite.id,
      site_name: targetSite.name,
      base_url: targetSite.base_url,
      page_url: targetSite.base_url,
      inspected_at: getJapanIsoString(),
      inspection_status: "success",
      errors: [],

      title_found: false,
      title_text: "",

      meta_description_found: false,
      meta_description: null,

      canonical_found: false,
      canonical_url: null,

      html_lang_found: false,
      html_lang: null,
    };

    try {
      // 検査対象ページを開く
      const response = await openInspectionPage(page, targetSite.base_url);

      // 最終URLとHTTP応答を共通検査結果へ反映する
      applyPageOpenResult(summary, page.url(), response);

      // ページのDOMからメタ情報の事実を収集する
      const metaInfo = await collectMetaInfo(page);

      // 収集したメタ情報を検査結果へ反映する
      summary.title_found = metaInfo.title_found;
      summary.title_text = metaInfo.title_text;

      summary.meta_description_found = metaInfo.meta_description_found;

      summary.meta_description = metaInfo.meta_description;

      summary.canonical_found = metaInfo.canonical_found;

      summary.canonical_url = metaInfo.canonical_url;

      summary.html_lang_found = metaInfo.html_lang_found;

      summary.html_lang = metaInfo.html_lang;
    } catch (error: unknown) {
      // 検査失敗を記録
      summary.inspection_status = "failed";

      summary.errors.push(
        error instanceof Error
          ? error.message
          : "メタ情報の収集中に不明なエラーが発生しました",
      );
    } finally {
      // 検査結果をJSONへ保存
      saveJsonFile(summaryPath, summary);

      console.log(`メタ情報JSONを保存しました: ${summaryPath}`);
      console.log(summary);
    }

    expect(summary.inspection_status, summary.errors.join("\n")).not.toBe(
      "failed",
    );
  });
});
