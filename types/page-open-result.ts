/**
 * 1ページをブラウザで開いた結果を表す。
 */

export type PageOpenStatus =
  | "success"
  | "partial"
  | "failed";

export interface PageOpenResult {
  /**
   * 開こうとしたURL。
   */
  requested_url: string;

  /**
   * ブラウザが最終的に到達したURL。
   *
   * ページ移動自体に失敗した場合はnull。
   */
  final_url: string | null;

  /**
   * HTTPレスポンスを取得できたか。
   */
  response_received: boolean;

  /**
   * HTTPステータスコード。
   *
   * レスポンスを取得できなかった場合はnull。
   */
  http_status: number | null;

  /**
   * HTTPレスポンスが正常応答だったか。
   *
   * レスポンスを取得できなかった場合はnull。
   */
  http_ok: boolean | null;

  /**
   * page.goto()が例外なく完了したか。
   *
   * 404ページでもブラウザ表示まで完了すればtrue。
   */
  opened: boolean;

  /**
   * 開こうとしたURLから別URLへ移動したか。
   *
   * ページ移動自体に失敗した場合はnull。
   */
  redirected: boolean | null;

  /**
   * ページを開いた処理の完了状態。
   *
   * success: 正常なHTTPレスポンスを取得した
   * partial: ページ移動は完了したがHTTP応答に問題がある
   * failed: ページ移動自体が失敗した
   */
  open_status: PageOpenStatus;

  /**
   * partialまたはfailedとなった理由。
   */
  error_message: string | null;
}
