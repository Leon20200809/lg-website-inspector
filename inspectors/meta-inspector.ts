/**
 * ページのDOMからメタ情報を収集する。
 *
 * Summaryの更新やJSON保存は行わず、
 * ブラウザから確認できた事実だけを返す。
 */

import type { Page } from "@playwright/test";

import type { MetaInfo } from "../types/meta-summary";

/**
 * ページのDOMからtitle・description・canonical・langを収集する。
 *
 * 要素の存在と、属性・文字列の値を分けて記録する。
 *
 * 例：
 * meta description要素は存在していても、
 * content属性が存在しなければmeta_descriptionはnullになる。
 *
 * @param page 検査対象ページを操作するPlaywrightのPage
 * @returns ページから収集したメタ情報
 */
export async function collectMetaInfo(page: Page): Promise<MetaInfo> {
  /*
   * title要素の存在を確認する。
   *
   * page.title()だけでは、
   * title要素がない場合と空文字の場合を区別しにくいため、
   * 要素の存在確認を別に行う。
   */
  const titleElement = page.locator("head > title").first();

  const titleFound = (await titleElement.count()) > 0;

  const titleText = titleFound ? await page.title() : "";

  /*
   * 属性名の大文字・小文字を区別せず、
   * name="description"のmeta要素を探す。
   *
   * CSSセレクタの i は、
   * ASCII文字の大文字・小文字を区別しない指定。
   */
  const descriptionElement = page.locator('meta[name="description" i]').first();

  const metaDescriptionFound = (await descriptionElement.count()) > 0;

  const metaDescription = metaDescriptionFound
    ? await descriptionElement.getAttribute("content")
    : null;

  /*
   * rel属性にcanonicalを含むlink要素を探す。
   *
   * ~= は、空白区切りの属性値に
   * 指定した単語が含まれるかを確認するCSSセレクタ。
   */
  const canonicalElement = page.locator('link[rel~="canonical" i]').first();

  const canonicalFound = (await canonicalElement.count()) > 0;

  const canonicalUrl = canonicalFound
    ? await canonicalElement.getAttribute("href")
    : null;

  /*
   * html要素のlang属性を取得する。
   *
   * getAttribute()は属性が存在しなければnullを返すため、
   * nullかどうかでlang属性の存在を判定できる。
   */
  const htmlElement = page.locator("html").first();

  const htmlLang = await htmlElement.getAttribute("lang");

  return {
    title_found: titleFound,
    title_text: titleText,

    meta_description_found: metaDescriptionFound,
    meta_description: metaDescription,

    canonical_found: canonicalFound,
    canonical_url: canonicalUrl,

    html_lang_found: htmlLang !== null,
    html_lang: htmlLang,
  };
}
