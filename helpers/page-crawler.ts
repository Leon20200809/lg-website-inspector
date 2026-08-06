import type { Page } from "@playwright/test";

import { openInspectionPage } from "./page-inspection";

import type { PageOpenResult } from "../types/page-open-result";
import type { PageTarget } from "../types/page-target";

/**
 * 1件のPageTargetをブラウザで開き、到達結果を返す。
 *
 * meta・見出し・画像・リンク・フォームの検査や、
 * JSONへの保存は行わない。
 *
 * @param page ページ移動に使用するPlaywrightのPage
 * @param target 開く対象となるPageTarget
 * @returns ページの到達結果
 */
export async function openPageTarget(
  page: Page,
  target: PageTarget,
): Promise<PageOpenResult> {
  const result: PageOpenResult = {
    requested_url: target.discovered_url,
    final_url: null,
    response_received: false,
    http_status: null,
    http_ok: null,
    opened: false,
    redirected: null,
    open_status: "failed",
    error_message: null,
  };

  try {
    const response = await openInspectionPage(
      page,
      target.discovered_url,
    );

    const finalUrl = page.url();

    result.final_url = finalUrl;
    result.opened = true;
    result.redirected =
      finalUrl !== target.discovered_url;

    if (response === null) {
      result.open_status = "partial";
      result.error_message =
        "ページ移動は完了しましたが、HTTPレスポンスを取得できませんでした";

      return result;
    }

    result.response_received = true;
    result.http_status = response.status();
    result.http_ok = response.ok();

    if (!response.ok()) {
      result.open_status = "partial";
      result.error_message =
        `ページが正常応答ではありませんでした: HTTP ${response.status()}`;

      return result;
    }

    result.open_status = "success";

    return result;
  } catch (error: unknown) {
    result.open_status = "failed";
    result.error_message =
      error instanceof Error
        ? error.message
        : "ページを開く処理で不明なエラーが発生しました";

    return result;
  }
}
