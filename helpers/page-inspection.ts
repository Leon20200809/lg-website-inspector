/**
 * 各検査で共通するページ移動と、
 * HTTP応答結果の反映処理を管理する。
 */

import type { Page, Response } from "@playwright/test";

import type { BaseInspectionSummary } from "../types/common";

/**
 * 検査対象ページを開き、最初のHTML解析が完了するまで待つ。
 *
 * CSS・画像・JavaScriptなどの読込完了までは待たない。
 * それらが必要な検査は、呼び出し側で
 * page.waitForLoadState("load")を実行する。
 *
 * @param page 検査対象ページを操作するPlaywrightのPage
 * @param url 検査対象ページのURL
 * @returns ページ移動によって得られたHTTPレスポンス
 */
export async function openInspectionPage(
  page: Page,
  url: string,
): Promise<Response | null> {
  return page.goto(url, {
    waitUntil: "domcontentloaded",
  });
}

/**
 * ページを開いた結果を、各検査で共通するSummary情報へ反映する。
 *
 * リダイレクト後の実際のURLを保存し、
 * HTTPレスポンスを取得できなかった場合や、
 * 正常応答でなかった場合はpartialとして記録する。
 *
 * HTTP応答に確認事項があっても例外は投げず、
 * 後続のDOM調査は継続できるようにする。
 *
 * @param summary 更新対象となる共通検査結果
 * @param finalPageUrl リダイレクト後に実際に表示されたURL
 * @param response ページ移動によって得られたHTTPレスポンス
 */
export function applyPageOpenResult(
  summary: BaseInspectionSummary,
  finalPageUrl: string,
  response: Response | null,
): void {
  // リダイレクト後の実際のURLを保存する
  summary.page_url = finalPageUrl;

  // HTTPレスポンスそのものを取得できなかった
  if (response === null) {
    summary.inspection_status = "partial";

    summary.errors.push("ページのHTTPレスポンスを取得できませんでした");

    return;
  }

  // 4xx・5xxなど、正常応答ではなかった
  if (!response.ok()) {
    summary.inspection_status = "partial";

    summary.errors.push(
      `ページが正常応答ではありませんでした: HTTP ${response.status()}`,
    );
  }
}
