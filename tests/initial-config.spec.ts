import { expect, test } from "@playwright/test";
import { createInitialConfig, isPublicAddress, normalizeInspectionUrl, selectInitialScope } from "../helpers/initial-config";
import { createLinkItems } from "../inspectors/link-inspector";

test("URLだけから設定を生成し、任意の事業目的を断定しない", () => {
  const config = createInitialConfig("https://example.com/service/#detail");
  expect(config.url).toBe("https://example.com/service/");
  expect(config.max_pages).toBe(5);
  expect(config.allowed_origins).toEqual(["https://example.com"]);
  expect(config.purpose).toBeNull();
  expect(config.allow_local).toBe(false);
  expect(normalizeInspectionUrl("https://example.com/service")).not.toBe(config.url);
});

test("認証情報・非HTTP・異常な上限・範囲外の重要URLを拒否する", () => {
  for (const url of ["invalid", "file:///tmp/a", "https://user:pass@example.com/"]) expect(() => createInitialConfig(url)).toThrow();
  expect(() => createInitialConfig("https://example.com", { max_pages: 0 })).toThrow();
  expect(() => createInitialConfig("https://example.com", { important_urls: ["https://other.example.com/"] })).toThrow();
  for (const ip of ["127.0.0.1", "10.2.3.4", "169.254.169.254", "192.168.1.1", "::1", "::ffff:127.0.0.1", "fc00::1"]) expect(isPublicAddress(ip)).toBe(false);
  expect(isPublicAddress("8.8.8.8")).toBe(true);
  expect(isPublicAddress("192.0.3.1")).toBe(true);
  expect(isPublicAddress("198.51.101.1")).toBe(true);
  expect(isPublicAddress("198.51.100.1")).toBe(false);
});

test("起点・重要URL・内部のサービス等を優先し、上限と除外理由を残す", () => {
  const config = createInitialConfig("https://example.com/", { max_pages: 3, excluded_urls: ["https://example.com/private"] });
  const hrefs = ["/news", "/contact", "/service", "/service#detail", "/private", "/file.pdf", "https://other.example.com/", "/logout"];
  const links = createLinkItems(hrefs.map(href => ({ href, text: "", target: null, rel: null })), config.url, new Set());
  const scope = selectInitialScope(config, links);
  expect(scope.filter(item => item.selected).map(item => item.url)).toEqual([config.url, "https://example.com/contact", "https://example.com/service"]);
  expect(scope.find(item => item.url.endsWith("/news"))?.reason).toBe("ページ数上限");
  expect(scope.find(item => item.url.endsWith("/private"))?.reason).toBe("指定除外URL");
  expect(scope.find(item => item.url.includes("other.example"))?.selected).toBe(false);
  expect(scope.find(item => item.url.endsWith("/logout"))?.selected).toBe(false);
});
