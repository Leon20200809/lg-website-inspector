import fs from "node:fs";
import path from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { chromium, type BrowserContext, type Page } from "@playwright/test";
import { collectMetaInfo } from "../inspectors/meta-inspector";
import { collectTechnologyInfo } from "../inspectors/technology-inspector";
import { collectFormItems } from "../inspectors/form-inspector";
import { collectHeadingItems } from "../inspectors/heading-inspector";
import { collectImageItems, scrollThroughPage } from "../inspectors/image-inspector";
import { collectExistingIdSet, collectRawLinks, createLinkItems } from "../inspectors/link-inspector";
import { openPageTarget } from "./page-crawler";
import { assertPublicUrl, normalizeInspectionUrl, selectInitialScope, scopeExclusionReason } from "./initial-config";
import type { InitialInspectionConfig, InitialRunManifest, ObservationCheck, PageObservation, ViewportProfile } from "../types/initial-report";
import type { PageOpenResult } from "../types/page-open-result";

interface NavigationGuard {
  redirects: Map<string, { status: number; target: string }>;
  responseHeaders: Map<string, Record<string, string>>;
}

export const INITIAL_VIEWPORTS: ViewportProfile[] = [
  { name: "pc", width: 1280, height: 900 },
  { name: "sp", width: 390, height: 844 },
];

/** JSONを一時ファイル経由で保存し、書き込み途中の台帳が残るのを防ぐ。 */
export function saveInitialJson(filename: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filename), { recursive: true });
  const tmp = `${filename}.${randomUUID()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2) + "\n", "utf8");
  fs.renameSync(tmp, filename);
}

/** 日時と乱数を組み合わせて、他の点検と衝突しない保存先を作る。 */
export function createRunDirectory(config: InitialInspectionConfig, reportsDir = "reports"): { runDir: string; runId: string } {
  const runId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`;
  const runDir = path.resolve(reportsDir, config.site_id, runId);
  fs.mkdirSync(runDir, { recursive: true });
  return { runDir, runId };
}

/** URLと表示幅に対応する未実施の観測レコードと証拠パスを作る。 */
export function createPageObservation(url: string, viewport: ViewportProfile): PageObservation {
  const hash = createHash("sha256").update(url).digest("hex").slice(0, 12);
  /** 未実施と取得失敗を区別できる空の検査結果を返す。 */
  const empty = <T>(): ObservationCheck<T> => ({ status: "not_run", data: null, error: null });
  return {
    id: `${viewport.name}-${hash}`, requested_url: url, viewport, observed_at: null, state: "pending", open: null,
    evidence_file: `chromium/${viewport.name}/${hash}/observation.json`,
    screenshots: { viewport: null, full: null, form: null }, screenshot_error: null,
    checks: { meta: empty(), forms: empty(), headings: empty(), images: empty(), links: empty(), layout: empty(), technology: empty() },
  };
}

/** 個別の収集を実行し、成功値または失敗理由を結果として返す。 */
async function collectCheck<T>(collect: () => Promise<T>): Promise<ObservationCheck<T>> {
  try { return { status: "complete", data: await collect(), error: null }; }
  catch (error) { return { status: "failed", data: null, error: String(error) }; }
}

/** 対象範囲外の移動と送信通信を止め、転送先と公開応答ヘッダを記録する。 */
async function installReadOnlyGuard(context: BrowserContext, config: InitialInspectionConfig, checked: Map<string, Promise<void>>): Promise<NavigationGuard> {
  const guard: NavigationGuard = { redirects: new Map(), responseHeaders: new Map() };
  await context.route("**/*", async route => {
    const request = route.request();
    const rawUrl = request.url();
    if (rawUrl.startsWith("data:") || rawUrl.startsWith("blob:")) return route.continue();
    try {
      const url = new URL(normalizeInspectionUrl(rawUrl));
      if (!["GET", "HEAD", "OPTIONS"].includes(request.method())) return route.abort("blockedbyclient");
      const mainNavigation = request.isNavigationRequest() && request.frame() === request.frame().page().mainFrame();
      if (mainNavigation) {
        if (scopeExclusionReason(normalizeInspectionUrl(rawUrl), config)) return route.abort("blockedbyclient");
      }
      if (!checked.has(url.origin)) checked.set(url.origin, assertPublicUrl(url.href, config.allow_local));
      await checked.get(url.origin);
      if (mainNavigation) {
        // Playwright routes run only for the first URL in an automatic redirect chain.
        // Fetch one hop, then let openScopedPage start each allowed hop as a fresh navigation.
        const response = await route.fetch({ maxRedirects: 0, timeout: config.timeout_ms });
        const location = response.headers()["location"];
        if ([301, 302, 303, 307, 308].includes(response.status()) && location) {
          guard.redirects.set(normalizeInspectionUrl(rawUrl), { status: response.status(), target: normalizeInspectionUrl(new URL(location, rawUrl).href) });
          await response.dispose();
          return route.abort("blockedbyclient");
        }
        guard.responseHeaders.set(normalizeInspectionUrl(rawUrl), response.headers());
        await route.fulfill({ response });
        await response.dispose();
        return;
      }
      return route.continue();
    } catch { return route.abort("blockedbyclient"); }
  });
  return guard;
}

/** 各リダイレクト先を範囲確認してから開き、循環や対象外への転送を止める。 */
async function openScopedPage(page: Page, initialUrl: string, guard: NavigationGuard, config: InitialInspectionConfig): Promise<PageOpenResult> {
  let currentUrl = initialUrl;
  const visited = new Set<string>();
  for (let hop = 0; hop <= 5; hop++) {
    visited.add(currentUrl);
    guard.redirects.delete(currentUrl);
    const result = await openPageTarget(page, { discovered_url: currentUrl, normalized_url: currentUrl, final_url: null, depth: 0, discovered_from: null });
    const redirect = guard.redirects.get(currentUrl);
    if (!redirect) return { ...result, requested_url: initialUrl, redirected: currentUrl !== initialUrl || result.redirected };
    const reason = scopeExclusionReason(redirect.target, config) || (visited.has(redirect.target) ? "リダイレクト循環" : hop === 5 ? "リダイレクト上限" : null);
    if (reason) return { ...result, requested_url: initialUrl, response_received: true, http_status: redirect.status, http_ok: false, redirected: true, error_message: `転送先を取得しませんでした: ${reason} (${redirect.target})` };
    currentUrl = redirect.target;
  }
  throw new Error("リダイレクト上限に達しました。");
}

/** 1ページの情報と画像を段階保存し、途中の移動や取得失敗も観測結果に残す。 */
async function inspectPage(page: Page, record: PageObservation, runDir: string, checkpoint: () => void, guard: NavigationGuard, config: InitialInspectionConfig): Promise<void> {
  record.observed_at = new Date().toISOString();
  record.open = await openScopedPage(page, record.requested_url, guard, config);
  if (!record.open.opened) { record.state = "failed"; checkpoint(); return; }
  const observationUrl = page.url();
  let movedDuringObservation = false;
  /** 観測開始後のメインページへの移動要求を検知する。 */
  const onNavigation = (request: import("@playwright/test").Request) => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) movedDuringObservation = true;
  };
  /** 観測中のURL変化を検知して別ページの証拠混入を防ぐ。 */
  const onFrame = (frame: import("@playwright/test").Frame) => {
    if (frame === page.mainFrame() && normalizeInspectionUrl(frame.url()) !== normalizeInspectionUrl(observationUrl)) movedDuringObservation = true;
  };
  page.on("request", onNavigation); page.on("framenavigated", onFrame);
  record.state = "partial";
  checkpoint();
  try { await page.waitForLoadState("load", { timeout: 5000 }); }
  catch { /* bounded wait; image state remains independently recorded */ }
  record.checks.meta = await collectCheck(() => collectMetaInfo(page)); checkpoint();
  record.checks.technology = await collectCheck(() => collectTechnologyInfo(page, guard.responseHeaders.get(normalizeInspectionUrl(observationUrl)))); checkpoint();
  record.checks.forms = await collectCheck(() => collectFormItems(page)); checkpoint();
  record.checks.headings = await collectCheck(() => collectHeadingItems(page)); checkpoint();
  record.checks.links = await collectCheck(async () => {
    const ids = await collectExistingIdSet(page);
    // Legacy named anchors are valid targets too. Keep the original inspector API unchanged.
    const names = await page.locator("a[name]").evaluateAll(items => items.map(item => item.getAttribute("name") ?? ""));
    names.filter(Boolean).forEach(name => ids.add(name));
    return createLinkItems(await collectRawLinks(page), page.url(), ids);
  }); checkpoint();
  record.checks.images = await collectCheck(async () => {
    await scrollThroughPage(page);
    try {
      await page.waitForFunction(() => Array.from(document.images).every(img =>
        img.getClientRects().length === 0 || img.complete), { }, { timeout: 5000 });
    } catch { /* not_loaded/unknown stay distinct from broken */ }
    return collectImageItems(page);
  }); checkpoint();
  record.checks.layout = await collectCheck(() => page.evaluate(() => ({
    viewport_width: window.innerWidth,
    document_width: document.documentElement.scrollWidth,
    horizontal_overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
  })));
  const relativeDir = path.posix.dirname(record.evidence_file);
  fs.mkdirSync(path.join(runDir, relativeDir), { recursive: true });
  try {
    await page.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: "instant" }));
    await page.screenshot({ path: path.join(runDir, relativeDir, "viewport.png"), animations: "disabled", timeout: 10000 });
    record.screenshots.viewport = `${relativeDir}/viewport.png`;
    await page.screenshot({ path: path.join(runDir, relativeDir, "full.png"), fullPage: true, animations: "disabled", timeout: 10000 });
    record.screenshots.full = `${relativeDir}/full.png`;
    const forms = page.locator("form");
    for (let index = 0; index < await forms.count(); index++) {
      const form = forms.nth(index);
      if (await form.isVisible()) {
        await form.screenshot({ path: path.join(runDir, relativeDir, "form.png"), animations: "disabled", timeout: 5000 });
        record.screenshots.form = `${relativeDir}/form.png`;
        break;
      }
    }
  } catch (error) { record.screenshot_error = String(error); }
  record.state = record.open.open_status === "success" && !record.screenshot_error &&
    Object.values(record.checks).every(check => check.status === "complete") ? "complete" : "partial";
  page.off("request", onNavigation); page.off("framenavigated", onFrame);
  if (movedDuringObservation || normalizeInspectionUrl(page.url()) !== normalizeInspectionUrl(observationUrl)) {
    record.state = "failed";
    record.screenshot_error = "観測中に別URLへ移動したため、取得結果を改善判定に使用していません。";
    record.screenshots = { viewport: null, full: null, form: null };
  }
  checkpoint();
}

/** 全ページの到達状況と検査状態から実行全体の完了度を判定する。 */
export function summarizeRunStatus(pages: PageObservation[]): "complete" | "partial" | "failed" {
  if (!pages.some(page => page.open?.opened)) return "failed";
  return pages.every(page => page.state === "complete") ? "complete" : "partial";
}

/** 公開範囲内のページをPC・スマホ幅で巡回し、証拠と観測台帳を保存する。 */
export async function runInitialInspection(config: InitialInspectionConfig, reportsDir = "reports"): Promise<{ runDir: string; manifest: InitialRunManifest }> {
  const { runDir, runId } = createRunDirectory(config, reportsDir);
  let commit: string | null = null;
  try {
    commit = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    if (execFileSync("git", ["status", "--porcelain"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim()) commit += "+worktree";
  } catch { /* source archive */ }
  const manifest: InitialRunManifest = {
    schema_version: 1, run_id: runId, started_at: new Date().toISOString(), finished_at: null, status: "running",
    tool_version: "1.1.0-initial-report", source_commit: commit, browser: { name: "chromium", version: null }, config,
    scope: selectInitialScope(config, []), pages: [], errors: [],
    limitations: [
      "起点と起点から見つかる公開ページのみ。サイト全体の検査ではありません。",
      "フォームは構造の観測のみ。入力・送信・メール到達は未確認です。",
      "リンクは分類と選択ページへの到達のみ。全リンクや外部リンクのHTTP検査は未実施です。",
      "PC幅1280px・スマホ幅390pxのChromium表示。実機・メニュー操作・他ブラウザは未確認です。",
      "売上・問い合わせ件数・管理画面・更新状況・バックアップ・セキュリティ適合性は未確認です。",
      "技術情報は公開DOM・既知の実行時プロパティ・応答ヘッダの観測です。バックエンドや技術の不使用は断定できません。",
      "外部埋め込み・非GET通信の制限や実行環境の影響があります。疑わしい表示は通常環境で再確認してください。",
    ],
  };
  manifest.pages = manifest.scope.filter(item => item.selected).flatMap(item =>
    INITIAL_VIEWPORTS.map(viewport => createPageObservation(item.url, viewport)));
  /** 各ページの証拠JSONと実行全体の台帳を最新状態で保存する。 */
  const checkpoint = () => {
    for (const record of manifest.pages) saveInitialJson(path.join(runDir, record.evidence_file), record);
    saveInitialJson(path.join(runDir, "manifest.json"), manifest);
  };
  /** 中断シグナルを受けた時点の観測状態を保存して終了する。 */
  const onSignal = () => { manifest.status = "interrupted"; manifest.finished_at = new Date().toISOString(); checkpoint(); process.exit(130); };
  process.once("SIGINT", onSignal); process.once("SIGTERM", onSignal);
  checkpoint();
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    await assertPublicUrl(config.url, config.allow_local);
    const rawProxy = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
    const proxyUrl = rawProxy ? new URL(rawProxy) : null;
    const proxy = proxyUrl ? { server: `${proxyUrl.protocol}//${proxyUrl.host}`, username: decodeURIComponent(proxyUrl.username), password: decodeURIComponent(proxyUrl.password), bypass: "localhost,127.0.0.1,[::1]" } : undefined;
    browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH, proxy });
    manifest.browser.version = browser.version();
    const context = await browser.newContext({ viewport: INITIAL_VIEWPORTS[0], serviceWorkers: "block", acceptDownloads: false });
    const checkedOrigins = new Map<string, Promise<void>>();
    const rootGuard = await installReadOnlyGuard(context, config, checkedOrigins);
    const page = await context.newPage();
    page.setDefaultNavigationTimeout(config.timeout_ms);
    page.setDefaultTimeout(5000);
    const root = manifest.pages[0];
    if (!root || root.requested_url !== config.url) throw new Error("起点URLは公開ページの検査対象範囲に含まれていません。");
    await inspectPage(page, root, runDir, checkpoint, rootGuard, config);
    const rootLinks = root.state !== "failed" && root.open?.http_ok && root.checks.links.status === "complete" ? root.checks.links.data ?? [] : [];
    await context.close();
    manifest.scope = selectInitialScope(config, rootLinks, root.open?.final_url ?? config.url);
    manifest.pages = [root];
    for (const decision of manifest.scope.filter(value => value.selected)) {
      for (const viewport of INITIAL_VIEWPORTS) {
        if (decision.url === config.url && viewport.name === "pc") continue;
        manifest.pages.push(createPageObservation(decision.url, viewport));
      }
    }
    checkpoint();
    for (const record of manifest.pages.slice(1)) {
      console.log(`観測: ${record.viewport.name} ${record.requested_url}`);
      await new Promise(resolve => setTimeout(resolve, config.delay_ms));
      // New page/context per viewport to avoid carrying responsive DOM state across visits.
      const nextContext = await browser.newContext({ viewport: { width: record.viewport.width, height: record.viewport.height }, serviceWorkers: "block", acceptDownloads: false });
      const nextGuard = await installReadOnlyGuard(nextContext, config, checkedOrigins);
      const nextPage = await nextContext.newPage();
      nextPage.setDefaultNavigationTimeout(config.timeout_ms); nextPage.setDefaultTimeout(5000);
      try { await inspectPage(nextPage, record, runDir, checkpoint, nextGuard, config); }
      catch (error) { record.state = "failed"; manifest.errors.push(String(error)); checkpoint(); }
      finally { await nextContext.close(); }
    }
    manifest.status = summarizeRunStatus(manifest.pages);
  } catch (error) {
    manifest.errors.push(String(error));
    manifest.status = summarizeRunStatus(manifest.pages);
    if (manifest.status === "complete") manifest.status = "partial";
  } finally {
    manifest.finished_at = new Date().toISOString(); checkpoint();
    await browser?.close();
    process.removeListener("SIGINT", onSignal); process.removeListener("SIGTERM", onSignal);
  }
  return { runDir, manifest };
}
