/**
 * ページ内の画像情報を取得し、
 * image-summary.jsonへ保存する。
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

import {
  scrollThroughPage,
  waitForVisibleImageLoadResults,
  collectImageItems,
  applyImageSummary,
} from "../inspectors/image-inspector";

import type { ImageItem, ImageSummary } from "../types/image-summary";

const activeSites = getActiveTargetSites();

activeSites.forEach((targetSite) => {
  test(`${targetSite.name} の画像情報を収集する`, async ({ page }) => {
    const summaryPath = getSummaryJsonPath(targetSite.id, SUMMARY_FILES.image);

    // 検査結果の初期値を作成
    const summary: ImageSummary = {
      site_id: targetSite.id,
      site_name: targetSite.name,
      base_url: targetSite.base_url,
      page_url: targetSite.base_url,
      inspected_at: getJapanIsoString(),
      inspection_status: "success",
      errors: [],

      total_images: 0,
      missing_alt_count: 0,
      empty_alt_count: 0,
      broken_image_count: 0,
      images: [],
    };

    try {
      // 検査対象ページを開く
      const response = await openInspectionPage(page, targetSite.base_url);

      // 最終URLとHTTP応答を共通検査結果へ反映する
      applyPageOpenResult(summary, page.url(), response);

      // 通常画像の読み込み完了を待つ
      await page.waitForLoadState("load");

      // ページ全体を巡回し、lazy画像の読み込みを発火させる
      await scrollThroughPage(page);

      // 表示画像の読み込み結果が確定するまで待つ
      await waitForVisibleImageLoadResults(page);

      // ページ内に存在するすべてのimg要素から画像情報を収集する。
      const images: ImageItem[] = await collectImageItems(page);

      // 収集した画像情報をページ全体の集計結果へ反映する
      applyImageSummary(summary, images);
    } catch (error: unknown) {
      // 検査失敗を記録
      summary.inspection_status = "failed";

      summary.errors.push(
        error instanceof Error
          ? error.message
          : "画像情報の収集中に不明なエラーが発生しました",
      );
    } finally {
      // 検査結果をJSONへ保存
      saveJsonFile(summaryPath, summary);

      console.log(`画像情報JSONを保存しました: ${summaryPath}`);
      console.log(summary);
    }

    // 検査失敗時の本当のエラー内容をターミナルへ表示する
    console.log("inspection_status:", summary.inspection_status);
    console.log("errors:", summary.errors);

    expect(summary.inspection_status, summary.errors.join("\n")).not.toBe(
      "failed",
    );
  });
});
