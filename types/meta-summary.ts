/**
 * title・meta description・canonical・言語情報の型を定義する。
 */

import type { BaseInspectionSummary } from "./common";

/**
 * ページのDOMから収集するメタ情報。
 *
 * サイトID・検査日時・エラーなどは含まず、
 * ブラウザから確認できた事実だけを保持する。
 */
export interface MetaInfo {
  title_found: boolean;
  title_text: string;

  meta_description_found: boolean;
  meta_description: string | null;

  canonical_found: boolean;
  canonical_url: string | null;

  html_lang_found: boolean;
  html_lang: string | null;
}

/**
 * ページ全体のメタ情報検査結果。
 *
 * 共通検査情報と、DOMから収集したMetaInfoをまとめる。
 */
export interface MetaSummary extends BaseInspectionSummary, MetaInfo {}
