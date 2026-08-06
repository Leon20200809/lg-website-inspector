/**
 * 1サイト分の内部ページ巡回予定を表す。
 */

import type { PageTarget } from "./page-target";

export interface PageTargetSummary {
  /**
   * 検査対象サイトの識別子。
   */
  site_id: string;

  /**
   * レポートに表示するサイト名。
   */
  site_name: string;

  /**
   * 設定ファイルに登録された起点URL。
   */
  base_url: string;

  /**
   * ページ候補を生成した日時。
   */
  generated_at: string;

  /**
   * 重複排除後の巡回対象ページ数。
   */
  total_pages: number;

  /**
   * 巡回対象となる各ページ。
   */
  pages: PageTarget[];
}
