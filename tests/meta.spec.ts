/**
 * title・meta description・canonical・langを取得し、
 * meta-summary.jsonへ保存する。
 */

import { test, expect } from "@playwright/test";

import { getActiveTargetSites } from "../helpers/target";
import { getSummaryJsonPath, SUMMARY_FILES } from "../helpers/report-paths";
import { saveJsonFile } from "../helpers/json-file";
import { getJapanIsoString } from "../helpers/date";

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
      // ページを取得
      const response = await page.goto(targetSite.base_url, {
        waitUntil: "domcontentloaded",
      });

      summary.page_url = page.url();

      // HTTP応答を確認
      if (response === null) {
        summary.inspection_status = "partial";
        summary.errors.push("ページのHTTPレスポンスを取得できませんでした");
      } else if (!response.ok()) {
        summary.inspection_status = "partial";
        summary.errors.push(
          `ページが正常応答ではありませんでした: HTTP ${response.status()}`,
        );
      }

      // titleを取得
      const titleElement = page.locator("head > title").first();

      summary.title_found = (await titleElement.count()) > 0;

      if (summary.title_found) {
        summary.title_text = await page.title();
      }

      // meta descriptionを取得
      const descriptionElement = page
        .locator('meta[name="description" i]')
        .first();

      summary.meta_description_found = (await descriptionElement.count()) > 0;

      if (summary.meta_description_found) {
        summary.meta_description =
          await descriptionElement.getAttribute("content");
      }

      // canonicalを取得
      const canonicalElement = page.locator('link[rel~="canonical" i]').first();

      summary.canonical_found = (await canonicalElement.count()) > 0;

      if (summary.canonical_found) {
        summary.canonical_url = await canonicalElement.getAttribute("href");
      }

      // htmlのlang属性を取得
      const htmlElement = page.locator("html").first();
      const htmlLang = await htmlElement.getAttribute("lang");

      summary.html_lang_found = htmlLang !== null;
      summary.html_lang = htmlLang;
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
