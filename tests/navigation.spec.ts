import { test, expect } from "@playwright/test";
import { target_site } from "../helpers/target";

const max_check_count = 5;

/**
 * URLが検査対象サイト内の内部リンクかどうかを判定する
 *
 * @param href リンク先URL
 * @returns 内部リンクなら true
 */
function is_internal_page_url(href: string): boolean {
  const base_url = new URL(target_site.base_url);
  const link_url = new URL(href);

  if (link_url.origin !== base_url.origin) {
    return false;
  }

  if (link_url.hash && link_url.pathname === base_url.pathname) {
    return false;
  }

  return true;
}

/**
 * 重複URLを取り除く
 *
 * @param urls URL一覧
 * @returns 重複を取り除いたURL一覧
 */
function unique_urls(urls: string[]): string[] {
  return Array.from(new Set(urls));
}

test.describe("ナビゲーション確認", () => {
  test("トップページに内部リンクが存在する", async ({ page }) => {
    await page.goto(target_site.base_url, {
      waitUntil: "domcontentloaded",
    });

    const hrefs = await page.locator("a[href]").evaluateAll((links) => {
      return links
        .map((link) => (link as HTMLAnchorElement).href)
        .filter((href) => href !== "");
    });

    const internal_urls = unique_urls(
      hrefs.filter((href) => is_internal_page_url(href)),
    );

    expect(internal_urls.length).toBeGreaterThan(0);
  });

  test("主要な内部リンクが開ける", async ({ page }) => {
    await page.goto(target_site.base_url, {
      waitUntil: "domcontentloaded",
    });

    const hrefs = await page.locator("a[href]").evaluateAll((links) => {
      return links
        .map((link) => (link as HTMLAnchorElement).href)
        .filter((href) => href !== "");
    });

    const internal_urls = unique_urls(
      hrefs.filter((href) => is_internal_page_url(href)),
    ).slice(0, max_check_count);

    expect(internal_urls.length).toBeGreaterThan(0);

    for (const url of internal_urls) {
      console.log("checking url:", url);

      const response = await page.goto(url, {
        waitUntil: "domcontentloaded",
      });

      expect(
        response,
        `${url} のレスポンスが取得できませんでした`,
      ).not.toBeNull();
      expect(response?.ok(), `${url} が正常に開けませんでした`).toBeTruthy();
    }
  });
});
