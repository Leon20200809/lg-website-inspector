import type { Page } from "@playwright/test";

import type { LinkItem, LinkSummary } from "../types/link-summary";

/**
 * ページ内のa要素から、加工前のリンク情報を収集する。
 *
 * 表示文字・href・target・relを取得する。
 * URL分類やHTTP通信は行わず、DOM上の事実だけを返す。
 *
 * @param page 検査対象ページを操作するPlaywrightのPage
 * @returns DOMから取得した未加工のリンク情報
 */
export async function collectRawLinks(page: Page): Promise<RawLink[]> {
  // 後で実装
}

/**
 * 未加工のリンク情報を、検査用のLinkItemへ変換する。
 *
 * 相対URLの解決・内部外部分類・アンカー判定・
 * PDF判定・空href・仮リンク判定を行う。
 *
 * HTTPステータスの確認は行わず、
 * 各リンクの初期結果は未検査状態として作成する。
 *
 * @param rawLinks DOMから取得した未加工のリンク情報
 * @param pageUrl リダイレクト後を含む現在のページURL
 * @param existingIds ページ内に存在するid属性の一覧
 * @returns 分類・整形されたリンク情報
 */
export function createLinkItems(
  rawLinks: RawLink[],
  pageUrl: string,
  existingIds: string[],
): LinkItem[] {
  // 後で実装
}

/**
 * 収集・分類したリンク情報を、
 * ページ全体の集計結果へ反映する。
 *
 * リンク総数・内部リンク・外部リンク・アンカー・
 * 電話・メール・PDF・空href・仮リンクなどを集計する。
 *
 * @param summary 更新対象となるリンク検査結果
 * @param links 分類・整形済みのリンク情報
 */
export function applyLinkSummary(
  summary: LinkSummary,
  links: LinkItem[],
): void {
  // 後で実装
}
