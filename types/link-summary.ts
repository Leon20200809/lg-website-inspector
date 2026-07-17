/**
 * リンク分類・HTTP状態・リンク切れ情報の型を定義する。
 */

import type { BaseInspectionSummary } from "./common";

// リンクの種類
export type LinkType =
  | "internal"
  | "external"
  | "anchor"
  | "tel"
  | "mailto"
  | "other";

// リンク確認結果
export type LinkResultStatus = "ok" | "warning" | "broken" | "skipped";

// ページ内に存在する1つのリンク
export interface LinkItem {
  order: number;
  text: string;
  href: string;
  resolved_url: string;
  link_type: LinkType;
  is_pdf: boolean;
  http_status: number | null;
  result: LinkResultStatus;
  redirected: boolean;
  final_url: string;
  error_message: string;
}

// ページ全体のリンク情報
export interface LinkSummary extends BaseInspectionSummary {
  total_links: number;
  anchor_links: number;
  empty_href_links: number;
  placeholder_links: number;
  tel_links: number;
  mail_links: number;
  pdf_links: number;
  internal_links: number;
  external_links: number;
  suspicious_links: number;

  checked_links: number;
  successful_links: number;
  redirect_links: number;
  warning_links: number;
  broken_links: number;
  skipped_links: number;
  missing_anchor_links: number;

  links: LinkItem[];
}
