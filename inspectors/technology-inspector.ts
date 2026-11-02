import type { Page } from "@playwright/test";
import type { TechnologyDetection, TechnologyEvidence, TechnologyObservation } from "../types/technology-summary";

interface TechnologySnapshot {
  scripts: string[];
  stylesheets: string[];
  generators: string[];
  runtime: Record<string, string>;
  markers: string[];
}

const HEADER_ALLOWLIST = ["server", "x-powered-by", "via", "content-type"];

/** 既知のランタイムと公開DOMから技術名の手掛かりを操作せずに取り出す。 */
export async function collectTechnologyInfo(page: Page, responseHeaders: Record<string, string> = {}): Promise<TechnologyObservation> {
  const snapshot = await page.evaluate((): TechnologySnapshot => {
    const runtime: Record<string, string> = {};
    const global = window as unknown as Record<string, any>;
    /** ページが公開する既知のプロパティを読み、文字列だけを記録する。 */
    const read = (name: string, get: () => unknown): void => {
      try {
        const value = get();
        if (typeof value === "string" && value.length > 0) runtime[name] = value.slice(0, 120);
        else if (value === true) runtime[name] = "present";
      } catch { /* 一つの取得失敗で他の根拠を失わない。 */ }
    };
    read("jQuery.fn.jquery", () => global.jQuery?.fn?.jquery);
    read("jQuery.fn.modal.Constructor.VERSION", () => global.jQuery?.fn?.modal?.Constructor?.VERSION);
    read("bootstrap.Modal.VERSION", () => global.bootstrap?.Modal?.VERSION);
    read("jQuery.validator", () => typeof global.jQuery?.validator === "function");
    read("jQuery.validator.version", () => global.jQuery?.validator?.version);
    read("Popper", () => typeof global.Popper === "function" || typeof global.Popper?.createPopper === "function");
    read("Popper.version", () => global.Popper?.version);
    read("Modernizr._version", () => global.Modernizr?._version);
    read("React.version", () => global.React?.version);
    read("Vue.version", () => global.Vue?.version);
    read("angular.version.full", () => global.angular?.version?.full);
    const markers: string[] = [];
    if (document.querySelector("script#__NEXT_DATA__")) markers.push("script#__NEXT_DATA__");
    const angularVersion = document.querySelector("[ng-version]")?.getAttribute("ng-version");
    if (angularVersion) markers.push(`ng-version=${angularVersion.slice(0, 80)}`);
    return {
      scripts: Array.from(document.scripts).filter(item => item.hasAttribute("src")).map(item => item.src).slice(0, 150),
      stylesheets: Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel~="stylesheet"]')).map(item => item.href).slice(0, 150),
      generators: Array.from(document.querySelectorAll('meta[name="generator" i]')).map(item => (item.getAttribute("content") ?? "").slice(0, 300)),
      runtime,
      markers,
    };
  });
  return classifyTechnologySnapshot(snapshot, responseHeaders);
}

/** 取得済みの根拠を技術候補へ整理し、参照だけの情報を確定扱いしない。 */
export function classifyTechnologySnapshot(snapshot: TechnologySnapshot, responseHeaders: Record<string, string> = {}): TechnologyObservation {
  const evidence: TechnologyEvidence[] = [];
  /** 連番付きの根拠を保存し、その参照IDを返す。 */
  const addEvidence = (source: TechnologyEvidence["source"], key: string, value: string): string => {
    const id = `tech-${String(evidence.length + 1).padStart(3, "0")}`;
    evidence.push({ id, source, key, value: value.slice(0, 1500) });
    return id;
  };
  for (const url of snapshot.scripts) addEvidence("script_src", "script.src", url);
  for (const url of snapshot.stylesheets) addEvidence("stylesheet_href", "link.href", url);
  for (const generator of snapshot.generators) addEvidence("meta_generator", "meta[name=generator]", generator);
  for (const [key, value] of Object.entries(snapshot.runtime)) addEvidence("runtime", key, value);
  for (const marker of snapshot.markers) addEvidence("dom_marker", "selector", marker);
  for (const [key, value] of Object.entries(responseHeaders)) {
    if (HEADER_ALLOWLIST.includes(key.toLowerCase())) addEvidence("response_header", key.toLowerCase(), value);
  }
  const detections: TechnologyDetection[] = [];
  /** 対象の根拠がある場合だけ候補を追加し、版の取得元も保存する。 */
  const add = (name: string, category: TechnologyDetection["category"], runtimeKeys: string[], reference: RegExp, note = "参照名だけでは読み込み成功・利用箇所・版を確定できません。", declaration?: RegExp): void => {
    const runtime = evidence.filter(item => item.source === "runtime" && runtimeKeys.includes(item.key));
    const refs = evidence.filter(item => {
      if (!["script_src", "stylesheet_href"].includes(item.source)) return false;
      try {
        const url = new URL(item.value);
        if (!["https:", "http:"].includes(url.protocol)) return false;
        const value = category === "analytics" || category === "external_service" ? `${url.origin}${url.pathname}` : url.pathname;
        return reference.test(value);
      } catch { return false; }
    });
    const declared = declaration ? evidence.filter(item => ["meta_generator", "dom_marker"].includes(item.source) && declaration.test(item.value)) : [];
    if (!runtime.length && !refs.length && !declared.length) return;
    const versionEvidence = runtime.find(item => /^\d+\.\d+(?:\.\d+)?(?:[-+\w.]*)$/.test(item.value));
    const declarationVersion = declared.map(item => item.value.match(/\b(\d+\.\d+(?:\.\d+)?)\b/)?.[1]).find(Boolean);
    const filenameVersion = refs.map(item => item.value.match(/(?:[-@/])v?(\d+\.\d+(?:\.\d+)?)(?:[./-]|$)/)?.[1]).find(Boolean);
    const confidence = runtime.length ? "runtime_observed" : declared.length ? "declared" : "reference_only";
    detections.push({
      name, category, confidence,
      version: versionEvidence?.value ?? declarationVersion ?? filenameVersion ?? null,
      version_source: versionEvidence ? "runtime" : declarationVersion ? "declaration" : filenameVersion ? "filename" : null,
      evidence_ids: [...runtime, ...declared, ...refs].map(item => item.id),
      note: confidence === "runtime_observed" ? "実行環境の既知プロパティを観測しました。全機能の動作やファイルの真正性は未確認です。" : confidence === "declared" ? "ページ内の自己申告を観測しました。バックエンドの構成や稼働状況は未確認です。" : note,
    });
  };
  add("jQuery", "library", ["jQuery.fn.jquery"], /(?:^|\/)jquery(?:[-@/]\d|(?:\.min)?\.js(?:$|\/))/i);
  add("Bootstrap", "framework", ["jQuery.fn.modal.Constructor.VERSION", "bootstrap.Modal.VERSION"], /(?:\/|\b)bootstrap(?:[-.@/]|\.js|\.css)/i);
  add("jQuery Validation", "library", ["jQuery.validator", "jQuery.validator.version"], /jquery[.-]validat(?:e|ion)/i);
  add("Popper", "library", ["Popper", "Popper.version"], /(?:\/|@)popper(?:\.js|js|[-@/])/i);
  add("Modernizr", "library", ["Modernizr._version"], /modernizr/i);
  add("React", "framework", ["React.version"], /(?:\/|\b)react(?:[-.@/]|\.js)/i);
  add("Vue", "framework", ["Vue.version"], /(?:\/|\b)vue(?:[-.@/]|\.js)/i);
  add("AngularJS", "framework", ["angular.version.full"], /(?:\/|\b)angular(?:[-.@/]|\.js)/i);
  add("Angular", "framework", [], /@angular\//i, undefined, /^ng-version=/);
  add("Next.js", "framework", [], /\/_next\//, undefined, /^script#__NEXT_DATA__$/);
  add("WordPress", "cms", [], /\/(?:wp-content|wp-includes)\//, undefined, /\bWordPress\b/i);
  add("Google tag", "analytics", [], /https:\/\/www\.googletagmanager\.com\/(?:gtag\/js|gtm\.js)/i, "タグの参照を確認しました。計測・同意・受信状況は未確認です。");
  add("Google Fonts", "external_service", [], /https:\/\/fonts\.(?:googleapis|gstatic)\.com\//i, "フォント配信先の参照を確認しました。各フォントの実際の描画状況は未確認です。");
  add("Facebook SDK", "external_service", [], /https:\/\/connect\.facebook\.net\/.+sdk\.js/i, "SDKの参照を確認しました。連携や表示の正常動作は未確認です。");
  return {
    schema_version: 1,
    evidence,
    detections,
    unknowns: [
      "サーバー側言語・フレームワーク・データベース・ホスティング構成は、公開ページの観測だけでは確定していません。",
      "WordPress等の候補が検出されなくても、不使用を意味しません。",
      "ビルドツール・ソース管理・依存関係の更新方針・制作担当者の技術範囲は未確認です。",
    ],
    limitations: [
      "script/linkのURLと既知プロパティの観測です。ファイル名・自己申告は偽装や改変の可能性があります。",
      "HTTPヘッダは応答経路で観測した値です。プロキシ/CDNを反映する場合があり、設置元のサーバー製品は断定しません。",
      "追加のURL探索、管理画面アクセス、フォーム操作、脆弱性検査は行っていません。古い版名だけで危険と判定しません。",
    ],
  };
}
