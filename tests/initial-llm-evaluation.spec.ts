import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { createInitialConfig } from "../helpers/initial-config";
import { createPageObservation } from "../helpers/initial-inspection";
import { buildLlmFacts, compareLlmResults, exportLlmCase, readVerifiedLlmCase, sha256, stableJson, validateLlmResult, validateLlmSupplement } from "../helpers/llm-evaluation";
import type { InitialRunManifest } from "../types/initial-report";
import type { LlmReviewResult, LlmSupplement } from "../types/llm-evaluation";

/** 公開データを含まない、部分失敗した一ページの実行記録を作る。 */
function fixture(): InitialRunManifest {
  const page = createPageObservation("https://example.test/", { name: "pc", width: 1280, height: 900 });
  page.state = "partial";
  page.observed_at = "2026-10-28T00:00:00Z";
  page.open = { requested_url: page.requested_url, final_url: page.requested_url, response_received: true,
    http_status: 200, http_ok: true, opened: true, redirected: false, open_status: "success", error_message: null };
  page.checks.meta = { status: "failed", data: null, error: "fixture timeout" };
  page.checks.layout = { status: "complete", data: { viewport_width: 1280, document_width: 1280, horizontal_overflow: false }, error: null };
  const manifest: InitialRunManifest = {
    schema_version: 1, run_id: "fixture-run", started_at: "2026-10-28T00:00:00Z", finished_at: "2026-10-28T00:00:01Z",
    status: "partial", tool_version: "test", source_commit: null, browser: { name: "chromium", version: "test" },
    config: createInitialConfig(page.requested_url), scope: [{ url: page.requested_url, selected: true, reason: "起点" }],
    pages: [page], limitations: ["送信は未確認"], errors: [],
  };
  delete (page.checks as Record<string, unknown>).technology;
  return manifest;
}

/** 一時ディレクトリへ実験入力を作り、後始末関数と検証済み内容を返す。 */
function caseFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "lgwi-llm-"));
  const caseDir = path.join(root, "case");
  fs.writeFileSync(path.join(root, "manifest.json"), stableJson(fixture()));
  fs.writeFileSync(path.join(root, "report-content.json"), JSON.stringify({ hypothesis: "この人手の提案文は入力へ含めない" }));
  exportLlmCase(root, caseDir, path.resolve("prompts"));
  return { root, caseDir, context: readVerifiedLlmCase(caseDir), cleanup: () => fs.rmSync(root, { recursive: true, force: true }) };
}

/** スキーマに適合する最小の LLM 応答を作る。 */
function response(context: ReturnType<typeof readVerifiedLlmCase>): LlmReviewResult {
  return {
    schema_version: 1, case_id: context.manifest.case_id, case_sha256: context.manifest.case_sha256, facts_sha256: context.manifest.files["facts.json"]!,
    summary: { statement: "部分取得です。", fact_ids: [context.facts.facts[0]!.fact_id] },
    strengths: [], technologies: [], opportunities: [], unknowns: ["実送信・受信"], next_questions: ["点検目的は何ですか。"],
  };
}

/** 公開アセットのコードを別時点で読み取った補足観測を作る。 */
function supplement(): LlmSupplement {
  return { schema_version: 1, observations: [{ id: "fixture-script", observed_at: "2026-10-28T01:00:00Z",
    method: "public_asset_static_review", source_url: "https://example.test/form.js", source_sha256: "a".repeat(64),
    facts: [{ key: "failure_message", value: "失敗時の表示文字列", evidence_excerpt: 'catch(() => show("確認してください"))' }],
    limitations: ["コードを読んだ記録です。実送信・受信は未確認。"] }] };
}

test("事実のキー順・ID・ハッシュを固定し、人手の提案を含めない", () => {
  expect(stableJson({ b: 1, a: { d: 2, c: 3 } })).toBe(stableJson({ a: { c: 3, d: 2 }, b: 1 }));
  const manifest = fixture();
  const a = buildLlmFacts(manifest, "a".repeat(64));
  const b = buildLlmFacts(structuredClone(manifest), "a".repeat(64));
  expect(stableJson(a)).toBe(stableJson(b));
  expect(a.facts.map(fact => fact.fact_id)).toEqual(b.facts.map(fact => fact.fact_id));
  const setup = caseFixture();
  try {
    expect(fs.readFileSync(path.join(setup.caseDir, "input.txt"), "utf8")).not.toContain("この人手の提案文は入力へ含めない");
    expect(sha256(fs.readFileSync(path.join(setup.caseDir, "facts.json")))).toBe(setup.context.manifest.files["facts.json"]);
    expect(() => exportLlmCase(setup.root, setup.caseDir, path.resolve("prompts"))).not.toThrow();
  } finally { setup.cleanup(); }
});

test("失敗・未実施・目的不明を保持し、技術候補の既成分類を入力から除く", () => {
  const manifest = fixture();
  const facts = buildLlmFacts(manifest, "b".repeat(64));
  expect(facts.declared_context.purpose).toBeNull();
  expect(facts.facts.find(fact => fact.kind === "meta")?.value).toEqual({ status: "failed", data: null, error: "fixture timeout" });
  expect(facts.facts.find(fact => fact.kind === "technology")?.value).toMatchObject({ status: "not_run", data: null });
  (manifest.pages[0]!.checks as Record<string, unknown>).technology = { status: "complete", error: null,
    data: { schema_version: 1, evidence: [{ id: "tech-001", source: "runtime", key: "jQuery.fn.jquery", value: "3.7.1" }],
      detections: [{ name: "PRECLASSIFIED_NAME" }], unknowns: ["CMS未確認"], limitations: ["自己申告"] } };
  const withTech = buildLlmFacts(manifest, "b".repeat(64));
  expect(stableJson(withTech)).not.toContain("PRECLASSIFIED_NAME");
  expect(stableJson(withTech)).toContain("jQuery.fn.jquery");
});

test("入力ファイル変更と別の実験内容による上書きを拒否する", () => {
  const setup = caseFixture();
  try {
    fs.appendFileSync(path.join(setup.caseDir, "facts.json"), " ");
    expect(() => readVerifiedLlmCase(setup.caseDir)).toThrow(/ハッシュ/);
    expect(() => exportLlmCase(setup.root, setup.caseDir, path.resolve("prompts"))).toThrow(/上書き/);
  } finally { setup.cleanup(); }
});

test("出力形式・入力ハッシュ・未知の事実 ID・未知の URL を拒否する", () => {
  const setup = caseFixture();
  try {
    const valid = response(setup.context);
    expect(() => validateLlmResult(valid, setup.context)).not.toThrow();
    expect(() => validateLlmResult({ ...valid, extra: "余計な断定" }, setup.context)).toThrow(/未定義/);
    expect(() => validateLlmResult({ ...valid, case_id: "different-run" }, setup.context)).toThrow(/case_id/);
    expect(() => validateLlmResult({ ...valid, case_sha256: "0".repeat(64) }, setup.context)).toThrow(/case_sha256/);
    expect(() => validateLlmResult({ ...valid, facts_sha256: "0".repeat(64) }, setup.context)).toThrow(/facts_sha256/);
    expect(() => validateLlmResult({ ...valid, summary: { ...valid.summary, fact_ids: ["f-0000000000000000"] } }, setup.context)).toThrow(/未知の fact_id/);
    const candidate = { category: "form_receipt", page_url: "https://outside.test/", title: "到達確認を相談", priority: "medium" as const,
      priority_reason: "未確認", observation: "入力欄を観測", hypothesis: "受付確認が役立つ可能性", question: "担当は誰か", next_action: "要否を相談", fact_ids: valid.summary.fact_ids };
    expect(() => validateLlmResult({ ...valid, opportunities: [candidate] }, setup.context)).toThrow(/対象外/);
    expect(() => validateLlmResult({ ...valid, technologies: [{ name: "不明なCMS", version: "1.0", certainty: "unknown", statement: "不明", fact_ids: [] }] }, setup.context)).toThrow(/version/);
  } finally { setup.cleanup(); }
});

test("候補の分類・順位・引用集合を比較し、意味の一致や正しさは合格扱いしない", () => {
  const setup = caseFixture();
  try {
    const a = response(setup.context);
    const b = response(setup.context);
    b.summary.fact_ids.push(setup.context.facts.facts[1]!.fact_id);
    const comparison = compareLlmResults(a, b);
    expect(comparison.input_match).toBe(true);
    expect(comparison.cited_facts).toMatchObject({ jaccard: 0.5 });
    expect(comparison.opportunity_categories_and_pages).toMatchObject({ jaccard: null });
    expect(comparison.semantic_review).toBe("not_performed");
    expect(() => compareLlmResults(a, { ...b, facts_sha256: "0".repeat(64) })).toThrow(/異なる入力/);
  } finally { setup.cleanup(); }
});

test("別時点の静的観測を区別して保存し、補足入力のハッシュも検証する", () => {
  const setup = caseFixture();
  try {
    const supplementPath = path.join(setup.root, "supplement.json");
    fs.writeFileSync(supplementPath, stableJson(supplement()));
    const caseDir = path.join(setup.root, "case-with-supplement");
    exportLlmCase(setup.root, caseDir, path.resolve("prompts"), supplementPath);
    const context = readVerifiedLlmCase(caseDir);
    const fact = context.facts.facts.find(item => item.kind === "public_asset_static_review");
    expect(fact).toMatchObject({ observed_at: "2026-10-28T01:00:00Z", viewport: null, observation_state: "static_review", source: { file: "supplement.json" } });
    expect(context.manifest.files["supplement.json"]).toHaveLength(64);
    fs.appendFileSync(path.join(caseDir, "supplement.json"), " ");
    expect(() => readVerifiedLlmCase(caseDir)).toThrow(/ハッシュ/);
  } finally { setup.cleanup(); }
});

test("静的観測の未知メソッド・重複・ハッシュ欠落・不正日時を拒否する", () => {
  const sample = supplement();
  expect(() => validateLlmSupplement(sample)).not.toThrow();
  const wrongMethod = structuredClone(sample);
  Object.assign(wrongMethod.observations[0]!, { method: "llm_guessed" });
  expect(() => validateLlmSupplement(wrongMethod)).toThrow(/固定値/);
  const duplicate = structuredClone(sample);
  duplicate.observations.push(structuredClone(duplicate.observations[0]!));
  expect(() => validateLlmSupplement(duplicate)).toThrow(/重複/);
  const badHash = structuredClone(sample);
  badHash.observations[0]!.source_sha256 = "missing";
  expect(() => validateLlmSupplement(badHash)).toThrow(/形式/);
  const badTime = structuredClone(sample);
  badTime.observations[0]!.observed_at = "yesterday";
  expect(() => validateLlmSupplement(badTime)).toThrow(/日時/);
});

test("静的観測で示したアセットURLを候補の対象として受け入れ、未知のURLは拒否する", () => {
  const setup = caseFixture();
  try {
    const supplementPath = path.join(setup.root, "supplement.json");
    fs.writeFileSync(supplementPath, stableJson(supplement()));
    const caseDir = path.join(setup.root, "asset-case");
    exportLlmCase(setup.root, caseDir, path.resolve("prompts"), supplementPath);
    const context = readVerifiedLlmCase(caseDir);
    const fact = context.facts.facts.find(item => item.kind === "public_asset_static_review")!;
    const result = response(context);
    result.opportunities = [{ category: "form_receipt", page_url: fact.page_url,
      title: "失敗時の案内を確認", priority: "medium", priority_reason: "公開コードの分岐を確認したため",
      observation: "静的観測に失敗時の表示がある", hypothesis: "受付状態を伝える材料になる可能性",
      question: "実運用でどう表示されるか", next_action: "担当者と確認条件を決める", fact_ids: [fact.fact_id] }];
    expect(() => validateLlmResult(result, context)).not.toThrow();
    result.opportunities[0]!.page_url = "https://example.test/unobserved.js";
    expect(() => validateLlmResult(result, context)).toThrow(/対象外/);
  } finally { setup.cleanup(); }
});
