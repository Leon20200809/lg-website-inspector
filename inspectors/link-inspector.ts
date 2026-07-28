import type { Page } from "@playwright/test";

import type { LinkItem, LinkSummary, LinkType } from "../types/link-summary";

// DOMから取得する未加工のリンク情報
type RawLink = {
  text: string;
  href: string | null;
  target: string | null;
  rel: string | null;
};

/**
 * ページ内のa要素から、加工前のリンク情報を収集する。
 *
 * 表示文字・href・target・relを取得する。
 * URL分類やHTTP通信は行わず、DOM上の事実だけを返す。
 *
 * @param page 検査対象ページを操作するPlaywrightのPage
 * @returns DOMから取得した未加工のリンク情報
 */
export async function collectRawLinks(page: Page): Promise<RawLink[]> {
  return page.locator("a").evaluateAll((elements) => {
    return elements.map((element) => {
      const anchor = element as HTMLAnchorElement;

      return {
        text: (anchor.textContent ?? "").trim().replace(/\s+/g, " "),

        href: anchor.getAttribute("href"),
        target: anchor.getAttribute("target"),
        rel: anchor.getAttribute("rel"),
      };
    });
  });
}

/**
 * DOMから取得した未加工リンクを、
 * 分類・URL解決・アンカー照合済みの
 * LinkItem[]へ整形する。
 *
 * この関数はDOMへアクセスせず、
 * 引数として受け取ったデータだけを使用する。
 *
 * @param rawLinks DOMから取得した未加工リンク情報
 * @param pageUrl 現在表示しているページのURL
 * @param existingIdSet ページ内に存在するid属性値の集合
 * @returns JSONへ保存できる正式なリンク情報
 */
export function createLinkItems(
  rawLinks: RawLink[],
  pageUrl: string,
  existingIdSet: Set<string>,
): LinkItem[] {
  return rawLinks.map((rawLink, index) => {
    // hrefをページ内・内部・外部などへ分類する
    const linkType = getLinkType(rawLink.href, pageUrl);

    // 相対URLを絶対URLへ変換する
    const resolvedUrl = getResolvedUrl(rawLink.href, pageUrl);

    // href属性なしと空文字をまとめて記録する
    const isEmptyHref = rawLink.href === null || rawLink.href.trim() === "";

    // #やjavascript:などの仮リンク候補
    const isPlaceholder = isPlaceholderLink(rawLink.href);

    /*
     * アンカーリンクの場合だけ、
     * URLのhashから移動先IDを取り出す。
     */
    const anchorTargetId =
      linkType === "anchor" ? getAnchorTargetId(rawLink.href, pageUrl) : null;

    /*
     * アンカーIDを取得できた場合だけ、
     * ページ内に対応するidが存在するか確認する。
     *
     * null:
     *   アンカー確認対象ではない
     *
     * true:
     *   移動先IDが存在する
     *
     * false:
     *   移動先IDが存在しない
     */
    const anchorTargetFound =
      anchorTargetId === null ? null : existingIdSet.has(anchorTargetId);

    return {
      // DOM上での出現順。indexは0始まりなので1を足す
      order: index + 1,

      // リンク内に表示されている正規化済み文字列
      text: rawLink.text,

      // HTMLへ書かれていたhref属性
      href: rawLink.href,

      // 現在ページを基準に解決した絶対URL
      resolved_url: resolvedUrl,

      // anchor・internal・externalなどの分類
      link_type: linkType,

      // 新しいタブ指定など
      target: rawLink.target,

      // noopener・nofollowなどの関係指定
      rel: rawLink.rel,

      // URLのpathnameが.pdfで終わるか
      is_pdf: isPdfLink(resolvedUrl),

      // href属性なし、または空文字か
      is_empty_href: isEmptyHref,

      // #・#!・javascript:などの仮リンク候補か
      is_placeholder: isPlaceholder,

      // ページ内アンカーの移動先IDが存在するか
      anchor_target_found: anchorTargetFound,

      /*
       * HTTP確認はこの関数の責務ではないため、
       * 初期状態を設定する。
       */
      http_status: null,
      result: "skipped",
      redirected: null,
      final_url: null,
      error_message: null,
    };
  });
}

/**
 * ページ内に存在する空でないid属性値を収集し、
 * アンカー移動先の存在確認に使えるSetとして返す。
 *
 * evaluateAll()内のブラウザ側では、
 * JSONへ変換しやすいstring[]として返す。
 *
 * 受け取ったNode.js側でSet<string>へ変換し、
 * 同じIDの重複排除と高速な存在確認を可能にする。
 *
 * @param page 検査対象ページを操作するPlaywrightのPage
 * @returns ページ内に存在するid属性値の集合
 */
export async function collectExistingIdSet(page: Page): Promise<Set<string>> {
  const existingIds = await page.locator("[id]").evaluateAll((elements) => {
    return elements.map((element) => element.id).filter((id) => id !== "");
  });

  return new Set(existingIds);
}

/**
 * 収集したリンク情報を、
 * ページ全体のリンク集計結果へ反映する。
 *
 * @param summary 更新対象となるリンク検査結果
 * @param links ページ内から収集したリンク情報
 */
export function applyLinkSummary(
  summary: LinkSummary,
  links: LinkItem[],
): void {
  summary.links = links;
  summary.total_links = links.length;

  summary.anchor_links = links.filter(
    (link) => link.link_type === "anchor",
  ).length;

  summary.empty_href_links = links.filter((link) => link.is_empty_href).length;

  summary.placeholder_links = links.filter(
    (link) => link.is_placeholder,
  ).length;

  summary.tel_links = links.filter((link) => link.link_type === "tel").length;

  summary.mail_links = links.filter(
    (link) => link.link_type === "mailto",
  ).length;

  summary.pdf_links = links.filter((link) => link.is_pdf).length;

  summary.internal_links = links.filter(
    (link) => link.link_type === "internal",
  ).length;

  summary.external_links = links.filter(
    (link) => link.link_type === "external",
  ).length;

  summary.other_links = links.filter(
    (link) => link.link_type === "other",
  ).length;

  summary.empty_text_links = links.filter((link) => link.text === "").length;

  summary.skipped_links = links.filter(
    (link) => link.result === "skipped",
  ).length;

  summary.missing_anchor_links = links.filter(
    (link) => link.link_type === "anchor" && link.anchor_target_found === false,
  ).length;
}

/**
 * ページ内アンカーURLから、
 * 移動先となるid属性値を取得する。
 *
 * 例：
 * "#contact"
 * → "contact"
 *
 * "/page/#company%20profile"
 * → "company profile"
 *
 * URLエンコードされた文字はdecodeURIComponent()で戻す。
 * デコードに失敗した場合は、元の文字列を返す。
 *
 * @param href a要素のhref属性
 * @param pageUrl URLを解決する基準となる現在ページ
 * @returns アンカー対象ID。取得不能ならnull
 */
function getAnchorTargetId(
  href: string | null,
  pageUrl: string,
): string | null {
  if (href === null || href.trim() === "") {
    return null;
  }

  try {
    const hash = new URL(href, pageUrl).hash;

    if (hash === "" || hash === "#") {
      return null;
    }

    // 先頭の#を除去する
    const targetId = hash.slice(1);

    try {
      return decodeURIComponent(targetId);
    } catch {
      /*
       * 不正なパーセントエンコードなどで
       * デコードできなくても、元のID候補は残す。
       */
      return targetId;
    }
  } catch {
    return null;
  }
}

/**
 * 解決後URLのパスが.pdfで終わるか確認する。
 *
 * クエリ文字列ではなくpathnameを確認するため、
 * "document.pdf?download=1"にも対応できる。
 *
 * @param resolvedUrl 絶対URLへ変換済みのURL
 * @returns PDFリンクならtrue
 */
function isPdfLink(resolvedUrl: string | null): boolean {
  if (resolvedUrl === null) {
    return false;
  }

  try {
    const url = new URL(resolvedUrl);

    return url.pathname.toLowerCase().endsWith(".pdf");
  } catch {
    return false;
  }
}

/**
 * 実際の移動先を持たない仮リンクか判定する。
 *
 * "#"・"#!"・"javascript:"は、
 * UI操作用または実装途中のリンクとして使われることがある。
 *
 * @param href a要素のhref属性
 * @returns 仮リンク候補ならtrue
 */
function isPlaceholderLink(href: string | null): boolean {
  if (href === null) {
    return false;
  }

  const trimmedHref = href.trim().toLowerCase();

  return (
    trimmedHref === "#" ||
    trimmedHref === "#!" ||
    trimmedHref.startsWith("javascript:")
  );
}

/**
 * HTMLに書かれたhrefを、
 * 現在ページを基準とした絶対URLへ変換する。
 *
 * "/contact/"や"../company/"などの相対URLにも対応する。
 *
 * hrefが未指定・空文字・URLとして解釈不能な場合は
 * nullを返す。
 *
 * @param href a要素のhref属性
 * @param pageUrl URLを解決する基準となる現在ページ
 * @returns 解決後の絶対URL。解決不能ならnull
 */
function getResolvedUrl(href: string | null, pageUrl: string): string | null {
  if (href === null || href.trim() === "") {
    return null;
  }

  try {
    return new URL(href, pageUrl).href;
  } catch {
    return null;
  }
}

/**
 * hrefの内容と現在ページのURLをもとに、
 * リンクの種類を判定する。
 *
 * URLの構造解析には正規表現ではなく、
 * JavaScript標準のURLクラスを使用する。
 *
 * hrefが空・不正・HTTP以外の場合はotherを返す。
 *
 * @param href a要素に書かれたhref属性
 * @param pageUrl 現在表示しているページのURL
 * @returns 判定したリンク種別
 */
function getLinkType(href: string | null, pageUrl: string): LinkType {
  if (href === null || href.trim() === "") {
    return "other";
  }

  const trimmedHref = href.trim();
  const lowerHref = trimmedHref.toLowerCase();

  // 電話発信用リンク
  if (lowerHref.startsWith("tel:")) {
    return "tel";
  }

  // メール作成用リンク
  if (lowerHref.startsWith("mailto:")) {
    return "mailto";
  }

  // JavaScriptを直接実行するリンク
  if (lowerHref.startsWith("javascript:")) {
    return "other";
  }

  try {
    /*
     * 第2引数へpageUrlを渡すことで、
     * "/contact/"や"../company/"などの相対URLも
     * 絶対URLとして解釈できる。
     */
    const currentUrl = new URL(pageUrl);
    const linkUrl = new URL(trimmedHref, pageUrl);

    /*
     * origin・pathname・searchが同じで、
     * hashだけが付いている場合はページ内アンカー。
     */
    const isSamePage =
      linkUrl.origin === currentUrl.origin &&
      linkUrl.pathname === currentUrl.pathname &&
      linkUrl.search === currentUrl.search;

    if (isSamePage && linkUrl.hash !== "") {
      return "anchor";
    }

    // http・https以外の独自プロトコル
    if (linkUrl.protocol !== "http:" && linkUrl.protocol !== "https:") {
      return "other";
    }

    // scheme・host・portを含むoriginが同じなら内部リンク
    if (linkUrl.origin === currentUrl.origin) {
      return "internal";
    }

    return "external";
  } catch {
    // URLとして解釈できないhref
    return "other";
  }
}
