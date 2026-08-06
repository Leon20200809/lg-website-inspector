import { expect, test } from "@playwright/test";

import { openPageTarget } from "../helpers/page-crawler";

import type { PageTarget } from "../types/page-target";

/**
 * テスト用のPageTargetを作る。
 */
function createPageTarget(url: string): PageTarget {
  return {
    discovered_url: url,
    normalized_url: url,
    final_url: null,
    depth: 1,
    discovered_from: "https://example.test/",
  };
}

test.describe("openPageTarget", () => {
  test("HTTP 200ならsuccessとして返す", async ({ page }) => {
    // Arrange：200を返す仮Webサーバーを用意する
    const target = createPageTarget(
      "https://example.test/success",
    );

    await page.route(target.discovered_url, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "text/html",
        body: "<html><body>success</body></html>",
      });
    });

    // Act：1ページを開く
    const result = await openPageTarget(page, target);

    // Assert：完成成果物を検証する
    expect(result).toEqual({
      requested_url: "https://example.test/success",
      final_url: "https://example.test/success",
      response_received: true,
      http_status: 200,
      http_ok: true,
      opened: true,
      redirected: false,
      open_status: "success",
      error_message: null,
    });
  });

  test("HTTP 404ならpartialとして返す", async ({ page }) => {
    // Arrange
    const target = createPageTarget(
      "https://example.test/not-found",
    );

    await page.route(target.discovered_url, async (route) => {
      await route.fulfill({
        status: 404,
        contentType: "text/html",
        body: "<html><body>not found</body></html>",
      });
    });

    // Act
    const result = await openPageTarget(page, target);

    // Assert
    expect(result.requested_url).toBe(
      "https://example.test/not-found",
    );

    expect(result.final_url).toBe(
      "https://example.test/not-found",
    );

    expect(result.response_received).toBe(true);
    expect(result.http_status).toBe(404);
    expect(result.http_ok).toBe(false);
    expect(result.opened).toBe(true);
    expect(result.redirected).toBe(false);
    expect(result.open_status).toBe("partial");

    expect(result.error_message).toBe(
      "ページが正常応答ではありませんでした: HTTP 404",
    );
  });

  test("通信に失敗したらfailedとして返す", async ({ page }) => {
    // Arrange
    const target = createPageTarget(
      "https://example.test/network-error",
    );

    await page.route(target.discovered_url, async (route) => {
      await route.abort("failed");
    });

    // Act
    const result = await openPageTarget(page, target);

    // Assert
    expect(result.requested_url).toBe(
      "https://example.test/network-error",
    );

    expect(result.final_url).toBeNull();
    expect(result.response_received).toBe(false);
    expect(result.http_status).toBeNull();
    expect(result.http_ok).toBeNull();
    expect(result.opened).toBe(false);
    expect(result.redirected).toBeNull();
    expect(result.open_status).toBe("failed");

    expect(result.error_message).not.toBeNull();
  });
});
