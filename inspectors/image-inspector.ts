import type { Page } from "@playwright/test";

import type { ImageItem, ImageSummary } from "../types/image-summary";

/**
 * ページを上部から下部まで段階的にスクロールする。
 *
 * 人間がページを順番に閲覧する状態を再現し、
 * 画面内への進入を条件とするlazy画像の読み込みを促す。
 *
 * 特定の画像要素を直接操作せず、
 * ページ全体を一定量ずつスクロールする。
 *
 * @param page 検査対象ページを操作するPlaywrightのPage
 */
export async function scrollThroughPage(page: Page): Promise<void> {
  // 後で実装
}

/**
 * ページ内に存在するすべてのimg要素から画像情報を収集する。
 *
 * src・currentSrc・alt・loading・complete・
 * naturalWidth・naturalHeightを取得し、
 * alt属性と読み込み状態を分類する。
 *
 * 画像の内容そのものは解析せず、
 * DOMとブラウザが保持する技術情報だけを返す。
 *
 * @param page 検査対象ページを操作するPlaywrightのPage
 * @returns ページ内に存在する画像情報の配列
 */
export async function collectImageItems(page: Page): Promise<ImageItem[]> {
  // 後で実装
  throw Error("これから");
}

/**
 * 収集した画像情報を、ページ全体の集計結果へ反映する。
 *
 * 画像総数・alt属性欠落数・空alt数・
 * 読み込み失敗画像数を集計し、ImageSummaryを更新する。
 *
 * @param summary 更新対象となる画像検査結果
 * @param images ページ内から収集した画像情報
 */
export function applyImageSummary(
  summary: ImageSummary,
  images: ImageItem[],
): void {
  // 後で実装
}
