import { test, expect } from "@playwright/test";
import { classifyTechnologySnapshot, collectTechnologyInfo } from "../inspectors/technology-inspector";

/** 比較条件を明示した空の技術観測データを作る。 */
function emptySnapshot() {
  return { scripts: [] as string[], stylesheets: [] as string[], generators: [] as string[], runtime: {} as Record<string, string>, markers: [] as string[] };
}

test("runtimeの版とファイル名の版を混同しない", () => {
  const snapshot = emptySnapshot();
  snapshot.scripts = ["https://example.com/jquery-1.0.0.min.js", "https://example.com/popper.js/1.14.7/popper.min.js"];
  snapshot.runtime = { "jQuery.fn.jquery": "3.4.1", "Popper": "present" };
  const result = classifyTechnologySnapshot(snapshot);
  expect(result.detections.find(item => item.name === "jQuery")).toMatchObject({ confidence: "runtime_observed", version: "3.4.1", version_source: "runtime" });
  expect(result.detections.find(item => item.name === "Popper")).toMatchObject({ confidence: "runtime_observed", version: "1.14.7", version_source: "filename" });
});

test("script参照だけでは実行やライブラリの存在を確定しない", () => {
  const snapshot = emptySnapshot();
  snapshot.scripts = ["https://example.com/bootstrap-4.3.1.js", "https://example.com/jquery.validate.min.js", "https://example.com/app.js?name=react-18.0.0.js"];
  const result = classifyTechnologySnapshot(snapshot);
  expect(result.detections.find(item => item.name === "Bootstrap")).toMatchObject({ confidence: "reference_only", version: "4.3.1", version_source: "filename" });
  expect(result.detections.find(item => item.name === "jQuery Validation")?.confidence).toBe("reference_only");
  expect(result.detections.some(item => item.name === "jQuery")).toBe(false);
  expect(result.detections.some(item => item.name === "React")).toBe(false);
});

test("未検出を不使用とせずCMSの自己申告も区別する", () => {
  const empty = classifyTechnologySnapshot(emptySnapshot());
  expect(empty.detections).toEqual([]);
  expect(empty.unknowns.some(item => item.includes("不使用を意味しません"))).toBe(true);
  const snapshot = emptySnapshot();
  snapshot.generators = ["WordPress 6.8.2"];
  const declared = classifyTechnologySnapshot(snapshot);
  expect(declared.detections.find(item => item.name === "WordPress")).toMatchObject({ confidence: "declared", version: "6.8.2", version_source: "declaration" });
});

test("応答ヘッダを設置サーバーの確定材料にせずcookieも保存しない", () => {
  const result = classifyTechnologySnapshot(emptySnapshot(), { server: "envoy", "x-powered-by": "PHP/8.3", "set-cookie": "private=value", via: "proxy" });
  expect(result.evidence.filter(item => item.source === "response_header").map(item => item.key)).toEqual(["server", "x-powered-by", "via"]);
  expect(result.detections).toEqual([]);
  expect(result.limitations.some(item => item.includes("プロキシ/CDN"))).toBe(true);
});

test("実ページの公開DOMと既知プロパティだけを取得する", async ({ page }) => {
  await page.route("**/*", route => route.abort());
  await page.setContent('<html><head><meta name="generator" content="Example generator"><link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Example"><script>window.jQuery={fn:{jquery:"3.4.1",modal:{Constructor:{VERSION:"4.3.1"}}},validator:function(){}};window.Modernizr={_version:"3.6.0"};</script></head><body><form method="post" action="https://example.com/send"><input name="email"></form></body></html>');
  const result = await collectTechnologyInfo(page, { server: "example-proxy" });
  expect(result.detections.find(item => item.name === "jQuery")).toMatchObject({ version: "3.4.1", version_source: "runtime" });
  expect(result.detections.find(item => item.name === "Bootstrap")).toMatchObject({ version: "4.3.1", version_source: "runtime" });
  expect(result.detections.find(item => item.name === "Modernizr")).toMatchObject({ version: "3.6.0", version_source: "runtime" });
  expect(result.detections.find(item => item.name === "jQuery Validation")).toMatchObject({ confidence: "runtime_observed", version: null });
  expect(result.detections.find(item => item.name === "Google Fonts")?.confidence).toBe("reference_only");
  expect(result.evidence.every(item => item.id.startsWith("tech-"))).toBe(true);
});
