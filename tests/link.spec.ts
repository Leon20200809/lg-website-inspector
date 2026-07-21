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

// DOMから取得する未加工のリンク情報
type RawLink = {
  text: string;
  href: string | null;
  target: string | null;
  rel: string | null;
};

/**
 * hrefからリンク種別を判定する
 */
function getLinkType(href: string | null, pageUrl: string): LinkType {
  if (href === null || href.trim() === "") {
    return "other";
  }

  const trimmedHref = href.trim();
  const lowerHref = trimmedHref.toLowerCase();

  if (lowerHref.startsWith("tel:")) {
    return "tel";
  }

  if (lowerHref.startsWith("mailto:")) {
    return "mailto";
  }

  if (lowerHref.startsWith("javascript:")) {
    return "other";
  }

  try {
    const currentUrl = new URL(pageUrl);
    const linkUrl = new URL(trimmedHref, pageUrl);

    const isSamePage =
      linkUrl.origin === currentUrl.origin &&
      linkUrl.pathname === currentUrl.pathname &&
      linkUrl.search === currentUrl.search;

    if (isSamePage && linkUrl.hash !== "") {
      return "anchor";
    }

    if (linkUrl.protocol !== "http:" && linkUrl.protocol !== "https:") {
      return "other";
    }

    if (linkUrl.origin === currentUrl.origin) {
      return "internal";
    }

    return "external";
  } catch {
    return "other";
  }
}

/**
 * 相対URLを絶対URLへ変換する
 */
function getResolvedUrl(href: string | null, pageUrl: string): string | null {
  if (href === null || href.trim() === "") {
    return null;
  }

  try {
    return new URL(href, pageUrl).href;
  } catch {
    return null;
  }
}

/**
 * 仮リンクとして使われるhrefか判定する
 */
function isPlaceholderLink(href: string | null): boolean {
  if (href === null) {
    return false;
  }

  const trimmedHref = href.trim().toLowerCase();

  return (
    trimmedHref === "#" ||
    trimmedHref === "#!" ||
    trimmedHref.startsWith("javascript:")
  );
}

/**
 * PDFへのリンクか判定する
 */
function isPdfLink(resolvedUrl: string | null): boolean {
  if (resolvedUrl === null) {
    return false;
  }

  try {
    const url = new URL(resolvedUrl);

    return url.pathname.toLowerCase().endsWith(".pdf");
  } catch {
    return false;
  }
}

/**
 * ページ内アンカーの対象IDを取得する
 */
function getAnchorTargetId(
  href: string | null,
  pageUrl: string,
): string | null {
  if (href === null || href.trim() === "") {
    return null;
  }

  try {
    const hash = new URL(href, pageUrl).hash;

    if (hash === "" || hash === "#") {
      return null;
    }

    const targetId = hash.slice(1);

    try {
      return decodeURIComponent(targetId);
    } catch {
      return targetId;
    }
  } catch {
    return null;
  }
}

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
      const rawLinks: RawLink[] = await page
        .locator("a")
        .evaluateAll((elements) => {
          return elements.map((element) => {
            const anchor = element as HTMLAnchorElement;

            return {
              text: (anchor.textContent ?? "").trim().replace(/\s+/g, " "),
              href: anchor.getAttribute("href"),
              target: anchor.getAttribute("target"),
              rel: anchor.getAttribute("rel"),
            };
          });
        });

      // ページ内に存在するIDを取得
      const existingIds = await page.locator("[id]").evaluateAll((elements) => {
        return elements.map((element) => element.id).filter((id) => id !== "");
      });

      const existingIdSet = new Set(existingIds);

      // リンク情報を整形
      const links: LinkItem[] = rawLinks.map((rawLink, index) => {
        const linkType = getLinkType(rawLink.href, summary.page_url);

        const resolvedUrl = getResolvedUrl(rawLink.href, summary.page_url);

        const isEmptyHref = rawLink.href === null || rawLink.href.trim() === "";

        const isPlaceholder = isPlaceholderLink(rawLink.href);

        const anchorTargetId =
          linkType === "anchor"
            ? getAnchorTargetId(rawLink.href, summary.page_url)
            : null;

        const anchorTargetFound =
          anchorTargetId === null ? null : existingIdSet.has(anchorTargetId);

        return {
          order: index + 1,
          text: rawLink.text,

          href: rawLink.href,
          resolved_url: resolvedUrl,
          link_type: linkType,

          target: rawLink.target,
          rel: rawLink.rel,

          is_pdf: isPdfLink(resolvedUrl),
          is_empty_href: isEmptyHref,
          is_placeholder: isPlaceholder,

          anchor_target_found: anchorTargetFound,

          http_status: null,
          result: "skipped",
          redirected: null,
          final_url: null,
          error_message: null,
        };
      });

      // リンク情報を集計
      summary.links = links;
      summary.total_links = links.length;

      summary.anchor_links = links.filter(
        (link) => link.link_type === "anchor",
      ).length;

      summary.empty_href_links = links.filter(
        (link) => link.is_empty_href,
      ).length;

      summary.placeholder_links = links.filter(
        (link) => link.is_placeholder,
      ).length;

      summary.tel_links = links.filter(
        (link) => link.link_type === "tel",
      ).length;

      summary.mail_links = links.filter(
        (link) => link.link_type === "mailto",
      ).length;

      summary.pdf_links = links.filter((link) => link.is_pdf).length;

      summary.internal_links = links.filter(
        (link) => link.link_type === "internal",
      ).length;

      summary.external_links = links.filter(
        (link) => link.link_type === "external",
      ).length;

      summary.other_links = links.filter(
        (link) => link.link_type === "other",
      ).length;

      summary.empty_text_links = links.filter(
        (link) => link.text === "",
      ).length;

      summary.skipped_links = links.filter(
        (link) => link.result === "skipped",
      ).length;

      summary.missing_anchor_links = links.filter(
        (link) =>
          link.link_type === "anchor" && link.anchor_target_found === false,
      ).length;
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
