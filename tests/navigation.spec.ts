// WEBサイトのリンク分類・アンカー・リンク切れを確認する
// npm run test -- tests/navigation.spec.ts

import {
  test,
  expect,
  type APIRequestContext,
  type Page,
} from "@playwright/test";

import { getActiveTargetSites } from "../helpers/target";
import { getSummaryJsonPath, SUMMARY_FILES } from "../helpers/report-paths";
import { saveJsonFile } from "../helpers/json-file";

type LinkType =
  | "internal"
  | "external"
  | "anchor"
  | "tel"
  | "mailto"
  | "other";

type LinkResultStatus = "ok" | "warning" | "broken" | "skipped";

type LinkResult = {
  text: string;
  href: string;
  resolved_url: string;
  link_type: LinkType;
  is_pdf: boolean;
  status: number | null;
  result: LinkResultStatus;
  redirected: boolean;
  final_url: string;
  error_message: string;
};

type HttpCheckResult = {
  status: number | null;
  result: LinkResultStatus;
  redirected: boolean;
  final_url: string;
  error_message: string;
};

// ページ内アンカーの移動先IDが存在するか確認する
async function anchorExists(page: Page, anchorId: string): Promise<boolean> {
  const decodedId = decodeURIComponent(anchorId);
  const anchorTarget = page.locator(`[id=${JSON.stringify(decodedId)}]`);

  return (await anchorTarget.count()) > 0;
}

// HTTPリンクへアクセスしてステータスと最終URLを取得する
async function checkHttpLink(
  request: APIRequestContext,
  url: string,
): Promise<HttpCheckResult> {
  try {
    const response = await request.get(url, {
      failOnStatusCode: false,
      maxRedirects: 10,
      timeout: 15_000,
    });

    const status = response.status();
    const finalUrl = response.url();
    const redirected = finalUrl !== url;

    if ([401, 403, 429].includes(status)) {
      return {
        status,
        result: "warning",
        redirected,
        final_url: finalUrl,
        error_message: `アクセス制限の可能性があります: HTTP ${status}`,
      };
    }

    if (status >= 200 && status < 400) {
      return {
        status,
        result: "ok",
        redirected,
        final_url: finalUrl,
        error_message: "",
      };
    }

    return {
      status,
      result: "broken",
      redirected,
      final_url: finalUrl,
      error_message: `リンク先が正常に応答しませんでした: HTTP ${status}`,
    };
  } catch (error: unknown) {
    return {
      status: null,
      result: "broken",
      redirected: false,
      final_url: "",
      error_message:
        error instanceof Error ? error.message : "リンク確認に失敗しました",
    };
  }
}

const activeSites = getActiveTargetSites();

activeSites.forEach((target_site) => {
  test(`${target_site.name} のリンクと遷移先を確認する`, async ({
    page,
    request,
  }) => {
    // トップページを開く
    await page.goto(target_site.base_url);

    // ページ内のリンクを取得する
    const links = page.locator("a");
    const linkCount = await links.count();

    // リンク検査の集計データを初期化する
    const summary = {
      site_id: target_site.id,
      site_name: target_site.name,
      base_url: target_site.base_url,
      total_links: linkCount,
      anchor_links: 0,
      empty_href_links: 0,
      placeholder_links: 0,
      tel_links: 0,
      mail_links: 0,
      pdf_links: 0,
      internal_links: 0,
      external_links: 0,
      suspicious_links: 0,
      checked_links: 0,
      successful_links: 0,
      redirect_links: 0,
      warning_links: 0,
      broken_links: 0,
      skipped_links: 0,
      missing_anchor_links: 0,
      link_results: [] as LinkResult[],
    };

    // 同じURLへの重複アクセスを防ぐ
    const checkedUrls = new Set<string>();

    console.log(`${target_site.name} のリンク数: ${linkCount}`);

    // 各リンクを分類して検査する
    for (let i = 0; i < linkCount; i++) {
      const link = links.nth(i);
      const text = (await link.textContent())?.trim() || "(テキストなし)";
      const href = (await link.getAttribute("href"))?.trim() || "";
      const lowerHref = href.toLowerCase();

      console.log("-----");
      console.log(`リンク番号: ${i + 1}`);
      console.log(`テキスト: ${text}`);
      console.log(`href: ${href || "(hrefなし)"}`);

      // hrefがないリンクはHTTP検査を行わない
      if (!href) {
        summary.empty_href_links++;
        summary.skipped_links++;

        summary.link_results.push({
          text,
          href,
          resolved_url: "",
          link_type: "other",
          is_pdf: false,
          status: null,
          result: "skipped",
          redirected: false,
          final_url: "",
          error_message: "hrefがありません",
        });

        continue;
      }

      // #だけのリンクは仮リンクとして記録する
      if (href === "#") {
        summary.placeholder_links++;
        summary.skipped_links++;

        summary.link_results.push({
          text,
          href,
          resolved_url: "",
          link_type: "anchor",
          is_pdf: false,
          status: null,
          result: "skipped",
          redirected: false,
          final_url: "",
          error_message: "#だけの仮リンクです",
        });

        continue;
      }

      // 同一ページ内アンカーの移動先を確認する
      if (href.startsWith("#")) {
        summary.anchor_links++;

        const anchorId = href.slice(1);
        const exists = await anchorExists(page, anchorId);

        if (!exists) {
          summary.missing_anchor_links++;
          summary.broken_links++;
        }

        summary.link_results.push({
          text,
          href,
          resolved_url: `${page.url()}${href}`,
          link_type: "anchor",
          is_pdf: false,
          status: null,
          result: exists ? "ok" : "broken",
          redirected: false,
          final_url: "",
          error_message: exists ? "" : `移動先IDが存在しません: ${anchorId}`,
        });

        continue;
      }

      // 電話リンクは存在だけ記録する
      if (lowerHref.startsWith("tel:")) {
        summary.tel_links++;
        summary.skipped_links++;

        summary.link_results.push({
          text,
          href,
          resolved_url: href,
          link_type: "tel",
          is_pdf: false,
          status: null,
          result: "skipped",
          redirected: false,
          final_url: "",
          error_message: "",
        });

        continue;
      }

      // メールリンクは存在だけ記録する
      if (lowerHref.startsWith("mailto:")) {
        summary.mail_links++;
        summary.skipped_links++;

        summary.link_results.push({
          text,
          href,
          resolved_url: href,
          link_type: "mailto",
          is_pdf: false,
          status: null,
          result: "skipped",
          redirected: false,
          final_url: "",
          error_message: "",
        });

        continue;
      }

      // JavaScriptリンクはHTTP検査を行わない
      if (lowerHref.startsWith("javascript:")) {
        summary.skipped_links++;

        summary.link_results.push({
          text,
          href,
          resolved_url: href,
          link_type: "other",
          is_pdf: false,
          status: null,
          result: "skipped",
          redirected: false,
          final_url: "",
          error_message: "JavaScriptリンクです",
        });

        continue;
      }

      let resolvedUrl: URL;

      // 相対URLを絶対URLへ変換する
      try {
        resolvedUrl = new URL(href, target_site.base_url);
      } catch {
        summary.suspicious_links++;
        summary.broken_links++;

        summary.link_results.push({
          text,
          href,
          resolved_url: "",
          link_type: "other",
          is_pdf: false,
          status: null,
          result: "broken",
          redirected: false,
          final_url: "",
          error_message: "URLとして解釈できません",
        });

        continue;
      }

      // HTTP以外のリンクは検査対象外にする
      if (!["http:", "https:"].includes(resolvedUrl.protocol)) {
        summary.skipped_links++;

        summary.link_results.push({
          text,
          href,
          resolved_url: resolvedUrl.href,
          link_type: "other",
          is_pdf: false,
          status: null,
          result: "skipped",
          redirected: false,
          final_url: "",
          error_message: `HTTP以外のリンクです: ${resolvedUrl.protocol}`,
        });

        continue;
      }

      const baseOrigin = new URL(target_site.base_url).origin;
      const linkType: LinkType =
        resolvedUrl.origin === baseOrigin ? "internal" : "external";

      const isPdf = resolvedUrl.pathname.toLowerCase().endsWith(".pdf");

      if (linkType === "internal") {
        summary.internal_links++;
      } else {
        summary.external_links++;
      }

      if (isPdf) {
        summary.pdf_links++;
      }

      // 不自然に連結されたWordPressパスを記録する
      if (href.includes(`${baseOrigin}wp-content`)) {
        summary.suspicious_links++;
      }

      // URLのハッシュを除いてHTTP検査する
      const requestUrl = new URL(resolvedUrl.href);
      requestUrl.hash = "";

      // 同じURLは一度だけHTTP検査する
      if (checkedUrls.has(requestUrl.href)) {
        summary.skipped_links++;

        summary.link_results.push({
          text,
          href,
          resolved_url: resolvedUrl.href,
          link_type: linkType,
          is_pdf: isPdf,
          status: null,
          result: "skipped",
          redirected: false,
          final_url: "",
          error_message: "同じURLを検査済みです",
        });

        continue;
      }

      checkedUrls.add(requestUrl.href);
      summary.checked_links++;

      // リンク先のHTTPステータスを確認する
      const checkResult = await checkHttpLink(request, requestUrl.href);

      if (checkResult.result === "ok") {
        summary.successful_links++;
      }

      if (checkResult.result === "warning") {
        summary.warning_links++;
      }

      if (checkResult.result === "broken") {
        summary.broken_links++;
      }

      if (checkResult.redirected) {
        summary.redirect_links++;
      }

      summary.link_results.push({
        text,
        href,
        resolved_url: resolvedUrl.href,
        link_type: linkType,
        is_pdf: isPdf,
        status: checkResult.status,
        result: checkResult.result,
        redirected: checkResult.redirected,
        final_url: checkResult.final_url,
        error_message: checkResult.error_message,
      });
    }

    // 検査結果をJSONとして保存する
    const summaryPath = getSummaryJsonPath(
      target_site.id,
      SUMMARY_FILES.navigation,
    );

    saveJsonFile(summaryPath, summary);

    console.log("===== リンク集計結果 =====");
    console.log(summary);
    console.log(`ナビゲーション集計JSONを保存しました: ${summaryPath}`);

    // ページが開いていることを確認する
    await expect(page).toHaveURL(/.+/);

    // 壊れたリンクがないことを確認する
    const brokenLinks = summary.link_results
      .filter((result) => result.result === "broken")
      .map((result) => `${result.href}: ${result.error_message}`)
      .join("\n");

    expect(
      summary.broken_links,
      `壊れたリンクが見つかりました\n${brokenLinks}`,
    ).toBe(0);
  });
});