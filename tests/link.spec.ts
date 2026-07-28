/**
 * ページ内のリンク情報を取得し、
 * link-summary.jsonへ保存する。
 */

import { test, expect } from "@playwright/test";

import { getActiveTargetSites } from "../helpers/target";
import { getSummaryJsonPath, SUMMARY_FILES } from "../helpers/report-paths";
import { saveJsonFile } from "../helpers/json-file";
import { getJapanIsoString } from "../helpers/date";

import type { LinkItem, LinkSummary, LinkType } from "../types/link-summary";
import {
  applyLinkSummary,
  collectRawLinks,
  collectExistingIdSet,
  createLinkItems,
} from "../inspectors/link-inspector";

// DOMから取得する未加工のリンク情報
type RawLink = {
  text: string;
  href: string | null;
  target: string | null;
  rel: string | null;
};

const activeSites = getActiveTargetSites();

activeSites.forEach((targetSite) => {
  test(`${targetSite.name} のリンク情報を収集する`, async ({ page }) => {
    const summaryPath = getSummaryJsonPath(targetSite.id, SUMMARY_FILES.link);

    // 検査結果の初期値を作成
    const summary: LinkSummary = {
      site_id: targetSite.id,
      site_name: targetSite.name,
      base_url: targetSite.base_url,
      page_url: targetSite.base_url,
      inspected_at: getJapanIsoString(),
      inspection_status: "success",
      errors: [],

      total_links: 0,

      anchor_links: 0,
      empty_href_links: 0,
      placeholder_links: 0,
      tel_links: 0,
      mail_links: 0,
      pdf_links: 0,
      internal_links: 0,
      external_links: 0,
      other_links: 0,
      empty_text_links: 0,

      http_check_status: "not_run",
      checked_links: 0,
      successful_links: 0,
      redirect_links: 0,
      warning_links: 0,
      broken_links: 0,
      skipped_links: 0,
      missing_anchor_links: 0,

      links: [],
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

      // a要素からリンク情報を取得
      const rawLinks: RawLink[] = await collectRawLinks(page);

      // ページ内に存在するid属性を収集する
      const existingIdSet = await collectExistingIdSet(page);

      // 未加工のリンク情報を正式なLinkItem[]へ整形する
      const links: LinkItem[] = createLinkItems(
        rawLinks,
        summary.page_url,
        existingIdSet,
      );

      // 収集したリンク情報をページ全体の集計結果へ反映する
      applyLinkSummary(summary, links);
    } catch (error: unknown) {
      // 検査失敗を記録
      summary.inspection_status = "failed";

      summary.errors.push(
        error instanceof Error
          ? error.message
          : "リンク情報の収集中に不明なエラーが発生しました",
      );
    } finally {
      // 検査結果をJSONへ保存
      saveJsonFile(summaryPath, summary);

      console.log(`リンク情報JSONを保存しました: ${summaryPath}`);
      console.log(summary);
    }

    expect(summary.inspection_status, summary.errors.join("\n")).not.toBe(
      "failed",
    );
  });
});
