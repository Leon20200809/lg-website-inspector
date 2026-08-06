import { expect, test } from "@playwright/test";

import {
  createRootPageTarget,
  extractInternalPageTargets,
  normalizePageUrl,
} from "../helpers/page-targets";

import type { LinkItem } from "../types/link-summary";

/**
 * テストに必要な最小差分だけ指定してLinkItemを作る。
 */
function createLinkItem(
  overrides: Partial<LinkItem> & Pick<LinkItem, "resolved_url" | "link_type">,
): LinkItem {
  return {
    order: 1,
    text: "テストリンク",
    href: overrides.resolved_url,
    target: null,
    rel: null,
    is_pdf: false,
    is_empty_href: false,
    is_placeholder: false,
    anchor_target_found: null,
    http_status: null,
    result: "skipped",
    redirected: null,
    final_url: null,
    error_message: null,
    ...overrides,
  };
}

test.describe("normalizePageUrl", () => {
  test("ルートURLの末尾スラッシュは残す", () => {
    expect(normalizePageUrl("https://example.com/")).toBe(
      "https://example.com/",
    );
  });

  test("ルート以外の末尾スラッシュを削除する", () => {
    expect(normalizePageUrl("https://example.com/entry/")).toBe(
      "https://example.com/entry",
    );
  });

  test("hashを削除する", () => {
    expect(normalizePageUrl("https://example.com/about/#message")).toBe(
      "https://example.com/about",
    );
  });

  test("クエリ文字列は残す", () => {
    expect(normalizePageUrl("https://example.com/news/?page=2")).toBe(
      "https://example.com/news?page=2",
    );
  });
});

test.describe("createRootPageTarget", () => {
  test("起点ページを深度0として作成する", () => {
    expect(createRootPageTarget("https://example.com/")).toEqual({
      discovered_url: "https://example.com/",
      normalized_url: "https://example.com/",
      final_url: null,
      depth: 0,
      discovered_from: null,
    });
  });
});

test.describe("extractInternalPageTargets", () => {
  test("検査可能な内部ページだけを抽出する", () => {
    const links: LinkItem[] = [
      createLinkItem({
        resolved_url: "https://example.com/about/",
        link_type: "internal",
      }),
      createLinkItem({
        resolved_url: "https://outside.example.net/",
        link_type: "external",
      }),
      createLinkItem({
        resolved_url: "https://example.com/document.pdf",
        link_type: "internal",
        is_pdf: true,
      }),
      createLinkItem({
        resolved_url: null,
        link_type: "other",
        is_empty_href: true,
      }),
      createLinkItem({
        resolved_url: "https://example.com/#",
        link_type: "internal",
        is_placeholder: true,
      }),
    ];

    const targets = extractInternalPageTargets(
      links,
      "https://example.com/",
    );

    expect(targets).toHaveLength(1);

    expect(targets[0]).toEqual({
      discovered_url: "https://example.com/about/",
      normalized_url: "https://example.com/about",
      final_url: null,
      depth: 1,
      discovered_from: "https://example.com/",
    });
  });

  test("/entryと/entry/を同じページとして重複排除する", () => {
    const links: LinkItem[] = [
      createLinkItem({
        order: 1,
        resolved_url: "https://example.com/entry/",
        link_type: "internal",
      }),
      createLinkItem({
        order: 2,
        resolved_url: "https://example.com/entry",
        link_type: "internal",
      }),
    ];

    const targets = extractInternalPageTargets(
      links,
      "https://example.com/",
    );

    expect(targets).toHaveLength(1);
    expect(targets[0]?.normalized_url).toBe(
      "https://example.com/entry",
    );
  });

  test("hashだけが異なるURLを重複排除する", () => {
    const links: LinkItem[] = [
      createLinkItem({
        order: 1,
        resolved_url: "https://example.com/about/#company",
        link_type: "internal",
      }),
      createLinkItem({
        order: 2,
        resolved_url: "https://example.com/about/#access",
        link_type: "internal",
      }),
    ];

    const targets = extractInternalPageTargets(
      links,
      "https://example.com/",
      2,
    );

    expect(targets).toHaveLength(1);
    expect(targets[0]?.depth).toBe(2);
    expect(targets[0]?.normalized_url).toBe(
      "https://example.com/about",
    );
  });

  test("クエリ文字列が異なるURLは別ページとして残す", () => {
    const links: LinkItem[] = [
      createLinkItem({
        order: 1,
        resolved_url: "https://example.com/news?page=1",
        link_type: "internal",
      }),
      createLinkItem({
        order: 2,
        resolved_url: "https://example.com/news?page=2",
        link_type: "internal",
      }),
    ];

    const targets = extractInternalPageTargets(
      links,
      "https://example.com/",
    );

    expect(targets).toHaveLength(2);
  });
});
