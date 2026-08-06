/**
 * 内部ページ巡回の対象となる1ページを表す。
 */
export interface PageTarget {
  /**
   * リンクから発見したURL。
   */
  discovered_url: string;

  /**
   * 重複判定に使用する正規化済みURL。
   */
  normalized_url: string;

  /**
   * page.goto()後に実際に到達したURL。
   *
   * 未巡回時はnull。
   */
  final_url: string | null;

  /**
   * 起点ページから何階層目で発見したか。
   */
  depth: number;

  /**
   * このURLを発見したページ。
   *
   * 起点ページ自身の場合はnull。
   */
  discovered_from: string | null;
}
