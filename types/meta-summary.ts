/**
 * title・meta description・canonical・言語情報の型を定義する。
 */

import type { BaseInspectionSummary } from "./common";

// ページのmeta情報
export interface MetaSummary extends BaseInspectionSummary {
  title_found: boolean;
  title_text: string;

  meta_description_found: boolean;
  meta_description: string | null;

  canonical_found: boolean;
  canonical_url: string | null;

  html_lang_found: boolean;
  html_lang: string | null;
}
