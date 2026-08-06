import type { LinkItem } from "../types/link-summary";
import type { PageTarget } from "../types/page-target";

/**
 * ページURLを重複判定に使える形へ正規化する。
 *
 * - hashを削除する
 * - ルート以外の末尾スラッシュを削除する
 * - クエリ文字列は残す
 *
 * @param pageUrl 正規化する絶対URL
 * @returns 正規化済みURL
 */
export function normalizePageUrl(pageUrl: string): string {
  const url = new URL(pageUrl);

  // ページ内アンカーの違いは同じページとして扱う
  url.hash = "";

  // /entry と /entry/ を同じページとして扱う
  if (url.pathname !== "/") {
    url.pathname = url.pathname.replace(/\/+$/, "");
  }

  return url.href;
}

/**
 * 起点ページ自身のPageTargetを作成する。
 *
 * @param baseUrl 検査対象サイトの起点URL
 * @returns 深度0のPageTarget
 */
export function createRootPageTarget(baseUrl: string): PageTarget {
  return {
    discovered_url: baseUrl,
    normalized_url: normalizePageUrl(baseUrl),
    final_url: null,
    depth: 0,
    discovered_from: null,
  };
}

/**
 * 起点ページと、そのページから見つかった内部ページ候補をまとめる。
 *
 * 起点ページ自身へのリンクが存在しても、
 * 正規化URLを使って1件だけ残す。
 *
 * @param rootPageUrl 実際に表示された起点ページURL
 * @param links 起点ページから収集したリンク情報
 * @returns 起点ページを先頭にした巡回対象一覧
 */
export function createInitialPageTargets(
  rootPageUrl: string,
  links: LinkItem[],
): PageTarget[] {
  const rootTarget = createRootPageTarget(rootPageUrl);

  // 起点ページは既にpage.goto()で開いている
  rootTarget.final_url = rootPageUrl;

  const internalTargets = extractInternalPageTargets(
    links,
    rootPageUrl,
    1,
  ).filter((target) => target.normalized_url !== rootTarget.normalized_url);

  return [rootTarget, ...internalTargets];
}

/**
 * LinkItem[]から検査可能な内部ページ候補を重複なしで抽出する。
 *
 * @param links 1ページから収集したリンク情報
 * @param discoveredFrom リンクを発見したページURL
 * @param depth 起点ページからの深さ
 * @returns 内部ページ候補
 */
export function extractInternalPageTargets(
  links: LinkItem[],
  discoveredFrom: string,
  depth = 1,
): PageTarget[] {
  const targetsByNormalizedUrl = new Map<string, PageTarget>();

  for (const link of links) {
    const isInspectionTarget =
      link.link_type === "internal" &&
      link.resolved_url !== null &&
      !link.is_pdf &&
      !link.is_empty_href &&
      !link.is_placeholder;

    if (!isInspectionTarget || link.resolved_url === null) {
      continue;
    }

    let normalizedUrl: string;

    try {
      normalizedUrl = normalizePageUrl(link.resolved_url);
    } catch {
      // URLとして解釈できないリンクは巡回対象にしない
      continue;
    }

    // 同じ正規化URLは最初に発見した1件だけを残す
    if (targetsByNormalizedUrl.has(normalizedUrl)) {
      continue;
    }

    targetsByNormalizedUrl.set(normalizedUrl, {
      discovered_url: link.resolved_url,
      normalized_url: normalizedUrl,
      final_url: null,
      depth,
      discovered_from: discoveredFrom,
    });
  }

  return [...targetsByNormalizedUrl.values()];
}
