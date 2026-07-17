/**
 * ページ内の見出し構造とテキスト情報の型を定義する。
 */

import type { BaseInspectionSummary } from "./common";

// MVPで検査する見出しレベル
export type HeadingLevel = 1 | 2 | 3;

// ページ内に存在する1つの見出し
export interface HeadingItem {
  level: HeadingLevel;
  text: string;
  order: number;
}

// ページ全体の見出し情報
export interface HeadingSummary extends BaseInspectionSummary {
  total_headings: number;
  h1_count: number;
  h2_count: number;
  h3_count: number;
  empty_heading_count: number;
  headings: HeadingItem[];
}
