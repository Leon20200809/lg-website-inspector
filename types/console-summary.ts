/**
 * ブラウザコンソールエラーと通信失敗情報の型を定義する。
 */

import type { BaseInspectionSummary } from "./common";

// ブラウザコンソールに出力されたメッセージ
export interface ConsoleMessageItem {
  order: number;
  type: string;
  text: string;
  url: string | null;
  line_number: number | null;
  column_number: number | null;
}

// ページ内JavaScriptで発生した未処理エラー
export interface PageErrorItem {
  order: number;
  name: string;
  message: string;
  stack: string | null;
}

// 読み込みに失敗した通信リクエスト
export interface FailedRequestItem {
  order: number;
  url: string;
  method: string;
  resource_type: string;
  failure_text: string | null;
}

// ページ全体のブラウザエラー情報
export interface ConsoleSummary extends BaseInspectionSummary {
  console_error_count: number;
  console_warning_count: number;
  page_error_count: number;
  failed_request_count: number;

  console_messages: ConsoleMessageItem[];
  page_errors: PageErrorItem[];
  failed_requests: FailedRequestItem[];
}
