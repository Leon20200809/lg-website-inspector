import { expect, test } from "@playwright/test";

import { buildInitialReportContent, validateReportContent } from "../helpers/initial-findings";
import type { FormItem } from "../types/form-summary";
import type { ImageItem } from "../types/image-summary";
import type { InitialRunManifest, ObservationCheck, PageObservation } from "../types/initial-report";
import type { LinkItem } from "../types/link-summary";

function complete<T>(data: T): ObservationCheck<T> {
  return { status: "complete", data, error: null };
}

function createPage(name: "pc" | "sp" = "pc", url = "https://example.test/"): PageObservation {
  const id = `${new URL(url).pathname === "/" ? "home" : "contact"}-${name}`;
  return {
    id,
    requested_url: url,
    viewport: { name, width: name === "pc" ? 1280 : 390, height: 900 },
    observed_at: "2026-10-28T00:00:00Z",
    state: "complete",
    open: {
      requested_url: url, final_url: url, response_received: true, http_status: 200,
      http_ok: true, opened: true, redirected: false, open_status: "success", error_message: null,
    },
    evidence_file: `pages/${id}.json`,
    screenshots: { viewport: `images/${id}.png`, full: `images/${id}-full.png`, form: null },
    screenshot_error: null,
    checks: {
      meta: complete({ title_found: true, title_text: "サンプルページ", meta_description_found: false,
        meta_description: null, canonical_found: false, canonical_url: null, html_lang_found: true, html_lang: "ja" }),
      headings: complete([]), images: complete([]), forms: complete([]), links: complete([]),
      layout: complete({ viewport_width: name === "pc" ? 1280 : 390,
        document_width: name === "pc" ? 1280 : 390, horizontal_overflow: false }),
    },
  };
}

function createManifest(pages: PageObservation[] = [createPage()]): InitialRunManifest {
  return {
    schema_version: 1, run_id: "run-one", started_at: "2026-10-28T00:00:00Z",
    finished_at: "2026-10-28T00:01:00Z", status: "complete", tool_version: "test", source_commit: null,
    browser: { name: "chromium", version: "test" },
    config: { url: "https://example.test/", site_id: "example", display_name: "検証用サイト",
      purpose: null, concern: null, allowed_origins: ["https://example.test"], important_urls: [],
      excluded_urls: [], max_pages: 5, timeout_ms: 10000, delay_ms: 1000, allow_local: true },
    scope: [{ url: "https://example.test/", selected: true, reason: "起点" }], pages,
    limitations: ["送信・受信は未確認"], errors: [],
  };
}

function image(overrides: Partial<ImageItem> = {}): ImageItem {
  return {
    order: 1, src: "/image.png", current_src: "https://example.test/image.png",
    alt: "", alt_status: "empty", loading: null, complete: true, load_status: "loaded",
    loaded: true, natural_width: 200, natural_height: 100, ...overrides,
  };
}

function formWithMissingLabel(): FormItem {
  return {
    order: 1, action_attribute: "/contact", action: "https://example.test/contact", method: "POST",
    enctype: "application/x-www-form-urlencoded", field_count: 1, required_field_count: 1,
    missing_label_count: 1, submit_button_found: true, privacy_consent_found: false,
    fields: [{ order: 1, element: "input", input_type: "text", name: "name", id: "name",
      label_text: null, label_status: "missing", required: true, disabled: false, readonly: false,
      placeholder: "お名前", autocomplete: "name" }],
  };
}

function makeAllCandidates(page: PageObservation): void {
  page.checks.layout = complete({ viewport_width: page.viewport.width,
    document_width: page.viewport.width + 200, horizontal_overflow: true });
  page.checks.meta = complete({ title_found: false, title_text: "", meta_description_found: false,
    meta_description: null, canonical_found: false, canonical_url: null, html_lang_found: false, html_lang: null });
  page.checks.images = complete([image({ load_status: "broken", loaded: false, natural_width: 0, natural_height: 0 })]);
  page.checks.forms = complete([formWithMissingLabel()]);
  page.screenshots.form = `images/${page.id}-form.png`;
}

test.describe("初回レポートの根拠と誤判定防止", () => {
  test("空alt・画像リンク・仮リンク・空見出し等を自動で不具合にしない", () => {
    const page = createPage();
    page.checks.images = complete([image(), image({ order: 2, alt: null, alt_status: "missing" })]);
    page.checks.headings = complete([{ level: 1, text: "", order: 1 }, { level: 1, text: "別の見出し", order: 2 }]);
    const link: LinkItem = {
      order: 1, text: "", href: "#menu", resolved_url: "https://example.test/#menu", link_type: "anchor",
      target: null, rel: null, is_pdf: false, is_empty_href: false, is_placeholder: true,
      anchor_target_found: false, http_status: null, result: "skipped", redirected: null,
      final_url: null, error_message: null,
    };
    page.checks.links = complete([link]);
    const content = buildInitialReportContent(createManifest([page]));
    expect(content.findings).toEqual([]);
    expect(content.strengths.some((point) => /リンク切れ|SEO.*正常|フォーム.*正常/.test(point.text))).toBe(false);
    expect(content.owner_review).toBe("pending");
  });

  test("failed・not_run・data=nullを正常や改善候補へ変換しない", () => {
    const page = createPage();
    makeAllCandidates(page);
    page.state = "partial";
    page.checks.meta.status = "failed";
    page.checks.images.status = "not_run";
    page.checks.forms = { status: "complete", data: null, error: null };
    page.checks.layout.status = "failed";
    const content = buildInitialReportContent(createManifest([page]));
    expect(content.findings).toEqual([]);
    expect(content.strengths).toHaveLength(1);
    expect(content.strengths[0]?.text).toContain("HTTP 2xx");
    expect(content.summary).toContain("未確認");
  });

  test("ページ到達失敗と404画面を顧客サイトのDOM改善課題にしない", () => {
    const failed = createPage();
    makeAllCandidates(failed);
    failed.state = "failed";
    failed.open = null;
    const notFound = createPage("sp");
    makeAllCandidates(notFound);
    notFound.state = "partial";
    notFound.open = { ...notFound.open!, http_status: 404, http_ok: false, open_status: "partial" };
    const content = buildInitialReportContent(createManifest([failed, notFound]));
    expect(content.findings).toEqual([]);
    expect(content.strengths).toEqual([]);
    expect(content.summary).toContain("0条件でHTTP 2xx");
  });

  test("未読込・判定不能の画像をbroken扱いせず、全画像正常とも扱わない", () => {
    const page = createPage();
    page.checks.images = complete([
      image({ load_status: "not_loaded", loaded: false, complete: false, current_src: "", natural_width: 0, natural_height: 0 }),
      image({ order: 2, load_status: "unknown", loaded: false, complete: false, natural_width: 0, natural_height: 0 }),
    ]);
    const content = buildInitialReportContent(createManifest([page]));
    expect(content.findings).toEqual([]);
    expect(content.strengths.some((point) => point.text.includes("img要素"))).toBe(false);
  });

  test("PC/SPの同じ課題は統合し、全件を保持して最大3件表示はrendererへ委ねる", () => {
    const pc = createPage("pc");
    const sp = createPage("sp");
    makeAllCandidates(pc);
    makeAllCandidates(sp);
    const manifest = createManifest([pc, sp]);
    const content = buildInitialReportContent(manifest);
    expect(content.findings).toHaveLength(5);
    for (const finding of content.findings) {
      expect(finding.evidence_ids).toEqual([pc.id, sp.id]);
      expect(finding.evidence_files).toEqual([pc.evidence_file, sp.evidence_file]);
      expect(finding.observation).toContain("PC幅1280px");
      expect(finding.observation).toContain("スマートフォン幅390px");
      expect(finding.review_status).toBe("unreviewed");
    }
    expect(content.findings.find((finding) => finding.rule === "form-label")?.screenshot).toBe(pc.screenshots.form);
    expect(() => validateReportContent(manifest, content)).not.toThrow();
  });

  test("無効な入力欄のラベル欠落を優先候補に含めない", () => {
    const page = createPage();
    const form = formWithMissingLabel();
    form.fields[0]!.disabled = true;
    page.checks.forms = complete([form]);
    expect(buildInitialReportContent(createManifest([page])).findings).toEqual([]);
  });
});

test.describe("手修正したレポートの検証", () => {
  function fixture() {
    const page = createPage();
    makeAllCandidates(page);
    const other = createPage("pc", "https://example.test/contact");
    const manifest = createManifest([page, other]);
    return { manifest, content: buildInitialReportContent(manifest), page, other };
  }

  test("同じrunの根拠を維持した文章・確認状態の編集を受け入れる", () => {
    const { manifest, content } = fixture();
    content.findings[0]!.review_status = "confirmed";
    content.findings[0]!.review_note = "指定した幅で再表示し、はみ出す画像を確認しました。";
    content.findings[1]!.review_status = "dismissed";
    content.findings[1]!.review_note = "別の環境では正常な表示を確認しました。";
    content.owner_review = "completed";
    content.reviewer_note = "表示範囲と改善候補を確認しました。";
    expect(() => validateReportContent(manifest, content)).not.toThrow();
  });

  test("別runと未知の証拠IDを拒否する", () => {
    const { manifest, content } = fixture();
    expect(() => validateReportContent(manifest, { ...content, run_id: "another-run" })).toThrow(/run_id/);
    content.findings[0]!.evidence_ids = ["unknown-page"];
    expect(() => validateReportContent(manifest, content)).toThrow(/evidence_ids/);
  });

  test("証拠IDと一致しないJSON・他ページの画像・URLを拒否する", () => {
    const { manifest, content, other } = fixture();
    const wrongFile = structuredClone(content);
    wrongFile.findings[0]!.evidence_files = [other.evidence_file];
    expect(() => validateReportContent(manifest, wrongFile)).toThrow(/evidence_files/);
    const wrongImage = structuredClone(content);
    wrongImage.findings[0]!.screenshot = other.screenshots.viewport;
    expect(() => validateReportContent(manifest, wrongImage)).toThrow(/screenshot/);
    const wrongUrl = structuredClone(content);
    wrongUrl.findings[0]!.page_url = other.requested_url;
    expect(() => validateReportContent(manifest, wrongUrl)).toThrow(/page_url/);
  });

  test("パストラバーサルと外部画像URLを拒否する", () => {
    const { manifest, content } = fixture();
    const traversal = structuredClone(content);
    traversal.findings[0]!.evidence_files = ["../another-run/page.json"];
    expect(() => validateReportContent(manifest, traversal)).toThrow(/安全な相対/);
    const remote = structuredClone(content);
    remote.findings[0]!.screenshot = "https://outside.test/image.png";
    expect(() => validateReportContent(manifest, remote)).toThrow(/安全な相対/);
  });

  test("本文長・enum・重複ID・空の証拠を検証する", () => {
    const { manifest, content } = fixture();
    expect(() => validateReportContent(manifest, { ...content, summary: "あ".repeat(6001) })).toThrow(/summary/);
    expect(() => validateReportContent(manifest, { ...content, owner_review: "approved" })).toThrow(/owner_review/);
    const priority = structuredClone(content);
    Object.assign(priority.findings[0]!, { priority: "urgent" });
    expect(() => validateReportContent(manifest, priority)).toThrow(/priority/);
    const duplicate = structuredClone(content);
    duplicate.findings[1]!.id = duplicate.findings[0]!.id;
    expect(() => validateReportContent(manifest, duplicate)).toThrow(/重複/);
    const empty = structuredClone(content);
    empty.findings[0]!.evidence_ids = [];
    expect(() => validateReportContent(manifest, empty)).toThrow(/evidence_ids/);
    const oversized = structuredClone(content);
    oversized.findings[0]!.observation = "x".repeat(10001);
    expect(() => validateReportContent(manifest, oversized)).toThrow(/observation/);
  });
});
