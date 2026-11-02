import fs from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";
import MarkdownIt from "markdown-it";
import { createInitialConfig } from "../helpers/initial-config";
import { createPageObservation } from "../helpers/initial-inspection";
import { displayUrl, renderInitialReport } from "../helpers/initial-report-renderer";
import type { InitialReportContent, InitialRunManifest } from "../types/initial-report";

const cases = [
  { name: "日本語スラッグ", slug: "%E6%97%A5%E6%9C%AC%E8%AA%9E", display: "日本語" },
  { name: "英数字スラッグ", slug: "service-123", display: "service-123" },
  { name: "不正なUTF-8", slug: "%E6%97%A5%E6%9C%AC%E8%AA%9E%E0%A4", display: "%E6%97%A5%E6%9C%AC%E8%AA%9E%E0%A4" },
  { name: "不正なパーセント", slug: "bad%ZZ", display: "bad%ZZ" },
  { name: "構文文字と二重エンコード", slug: "%E6%97%A5%2F%3F%23%26%3Cscript%3E%5Bx%5D%7C%252F", display: "日%2F%3F%23%26<script>[x]|%2F" },
];

for (const example of cases) {
  test(`表示用URLの変換: ${example.name}`, () => {
    const suffix = "?q=%E6%97%A5%E6%9C%AC&next=%2Ffoo%3Fx%3D1#%E7%AF%80";
    expect(displayUrl(`https://example.test/${example.slug}${suffix}`))
      .toBe(`https://example.test/${example.display}${suffix}`);
    expect(displayUrl(`/${example.slug}${suffix}`)).toBe(`/${example.display}${suffix}`);
  });

  test(`表示用URL: ${example.name}を安全に出力し証拠値を変えない`, async ({ page }, testInfo) => {
    const suffix = "?q=%E6%97%A5%E6%9C%AC&next=%2Ffoo%3Fx%3D1#%E7%AF%80";
    const url = `https://example.test/${example.slug}${suffix}`;
    const displayedPath = `/${example.display}${suffix}`;
    const observation = createPageObservation(url, { name: "pc", width: 1280, height: 900 });
    const manifest: InitialRunManifest = {
      schema_version: 1, run_id: "url-display-fixture", started_at: "2026-11-02T00:00:00Z",
      finished_at: "2026-11-02T00:01:00Z", status: "partial", tool_version: "fixture", source_commit: null,
      browser: { name: "chromium", version: null },
      config: { ...createInitialConfig("https://example.test/"), url, display_name: "URL表示の検証用サイト" },
      scope: [{ url, selected: true, reason: "起点" }], pages: [observation],
      limitations: ["架空のfixtureによる表示確認です。実サイトの検査は行っていません。"], errors: [],
    };
    const content: InitialReportContent = {
      schema_version: 1, run_id: manifest.run_id, display_name: manifest.config.display_name,
      summary: "日本語URLを読みやすく表示するための確認用レポートです。", strengths: [],
      findings: [{ id: "fixture-finding", rule: "fixture", title: "URLの表示確認", page_url: url,
        priority: "low", priority_reason: "表示の回帰確認", observation: "架空のURLを使用しています。",
        hypothesis: "実サイトの課題は判定していません。", question: "URLの文字は読めますか。",
        next_action: "表示と元URLを照合します。", evidence_ids: [observation.id],
        evidence_files: [observation.evidence_file], screenshot: null, review_status: "unreviewed", review_note: null }],
      questions: [], owner_review: "pending", reviewer_note: null,
    };
    const runDir = testInfo.outputPath("run");
    await fs.mkdir(path.dirname(path.join(runDir, observation.evidence_file)), { recursive: true });
    const inputs = { "manifest.json": manifest, "report-content.json": content, [observation.evidence_file]: observation };
    for (const [file, value] of Object.entries(inputs)) await fs.writeFile(path.join(runDir, file), JSON.stringify(value));
    const before = JSON.stringify({ manifest, content });
    const paths = await renderInitialReport(runDir, manifest, content);
    expect(JSON.stringify({ manifest, content })).toBe(before);
    for (const [file, value] of Object.entries(inputs)) expect(await fs.readFile(path.join(runDir, file), "utf8")).toBe(JSON.stringify(value));
    expect((await fs.readFile(paths.pdfPath)).subarray(0, 5).toString()).toBe("%PDF-");

    await page.setContent(await fs.readFile(paths.htmlPath, "utf8"));
    await expect(page.locator(".site-url")).toHaveText(`https://example.test${displayedPath}`);
    await expect(page.locator(".finding")).toContainText(`対象：${displayedPath}`);
    await expect(page.locator("tbody tr td").first()).toHaveText(displayedPath);
    // URL表示は既存どおりプレーンテキスト。デコードでリンクや要素を生成しない。
    expect(await page.locator("a, script").count()).toBe(0);

    const markdown = await fs.readFile(paths.markdownPath, "utf8");
    await page.setContent(new MarkdownIt({ html: false, linkify: false }).render(markdown));
    await expect(page.locator("body")).toContainText(`https://example.test${displayedPath}`);
    await expect(page.locator("body")).toContainText(`対象：${displayedPath}`);
    await expect(page.locator("tbody tr td").first()).toHaveText(displayedPath);
    expect(await page.locator("a, script").count()).toBe(0);
    await testInfo.attach("確認用PDF", { path: paths.pdfPath, contentType: "application/pdf" });
  });
}
