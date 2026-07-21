/**
 * リンク構造とリンク確認結果の型を定義する。
 */

import type { BaseInspectionSummary } from "./common";

// リンク先の種類を分類する
export type LinkType =
  | "internal"
  | "external"
  | "anchor"
  | "tel"
  | "mailto"
  | "other";

// 個別リンクの確認結果を表す
export type LinkResultStatus = "ok" | "warning" | "broken" | "skipped";

// HTTP確認をどこまで実行したかを表す
export type LinkCheckStatus = "not_run" | "partial" | "completed";

// ページ内に存在する1つのリンク
export interface LinkItem {
  // DOM上の出現順を残す
  order: number;

  // 利用者に表示されるリンク文字列を残す
  text: string;

  // href属性なしと空文字を区別する
  href: string | null;

  // 相対URLを絶対URLへ変換して後続処理で使う
  resolved_url: string | null;

  // 内部・外部・アンカーなどの種類を表す
  link_type: LinkType;

  // 別タブで開くリンクか確認する
  target: string | null;

  // 外部リンクの関係属性を確認する
  rel: string | null;

  // PDFリンクを通常ページと区別する
  is_pdf: boolean;

  // hrefが空または存在しない事実を残す
  is_empty_href: boolean;

  // #やJavaScriptなど仮リンクの可能性を残す
  is_placeholder: boolean;

  // ページ内アンカーの移動先が存在するかを残す
  anchor_target_found: boolean | null;

  // リンク先から返されたHTTP状態コードを残す
  http_status: number | null;

  // 正常・警告・リンク切れなどの確認結果を残す
  result: LinkResultStatus;

  // 元URLから別URLへ転送されたかを残す
  redirected: boolean | null;

  // リダイレクト後に到達したURLを残す
  final_url: string | null;

  // 確認失敗時の原因を残す
  error_message: string | null;
}

// ページ全体のリンク情報
export interface LinkSummary extends BaseInspectionSummary {
  // ページ内の全リンク数
  total_links: number;

  // リンク種類と構造上の事実を集計する
  anchor_links: number;
  empty_href_links: number;
  placeholder_links: number;
  tel_links: number;
  mail_links: number;
  pdf_links: number;
  internal_links: number;
  external_links: number;
  other_links: number;
  empty_text_links: number;

  // HTTP確認を実行したか明確にする
  http_check_status: LinkCheckStatus;

  // HTTP確認結果を集計する
  checked_links: number;
  successful_links: number;
  redirect_links: number;
  warning_links: number;
  broken_links: number;
  skipped_links: number;

  // 移動先が存在しないページ内アンカー数
  missing_anchor_links: number;

  // 各リンクの根拠データを保持する
  links: LinkItem[];
}
