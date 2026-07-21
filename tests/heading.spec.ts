/**
 * h1〜h3の見出し構造を取得し、
 * heading-summary.jsonへ保存する。
 */

import { test, expect } from "@playwright/test";

import { getActiveTargetSites } from "../helpers/target";
import { getSummaryJsonPath, SUMMARY_FILES } from "../helpers/report-paths";
import { saveJsonFile } from "../helpers/json-file";

import type { HeadingItem, HeadingSummary } from "../types/heading-summary";

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
      inspected_at: new Date().toISOString(),
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

      // h1〜h3を取得
      const headingElements = page.locator("h1, h2, h3");

      const headings: HeadingItem[] = await headingElements.evaluateAll(
        (elements) => {
          return elements.map((element, index) => {
            const level = Number(
              element.tagName.slice(1),
            ) as HeadingItem["level"];

            const text = (element.textContent ?? "")
              .trim()
              .replace(/\s+/g, " ");

            return {
              level,
              text,
              order: index + 1,
            };
          });
        },
      );

      // 見出し数を集計
      summary.headings = headings;
      summary.total_headings = headings.length;

      summary.h1_count = headings.filter(
        (heading) => heading.level === 1,
      ).length;

      summary.h2_count = headings.filter(
        (heading) => heading.level === 2,
      ).length;

      summary.h3_count = headings.filter(
        (heading) => heading.level === 3,
      ).length;

      summary.empty_heading_count = headings.filter(
        (heading) => heading.text === "",
      ).length;
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
