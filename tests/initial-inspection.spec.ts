import { test, expect } from "@playwright/test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import http from "node:http";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { createInitialConfig } from "../helpers/initial-config";
import { createPageObservation, createRunDirectory, runInitialInspection } from "../helpers/initial-inspection";

test("連続実行とPC/SPの証拠パスが衝突しない", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lgwi-path-"));
  try {
    const config = createInitialConfig("https://example.com/");
    const first = createRunDirectory(config, tmp);
    fs.writeFileSync(path.join(first.runDir, "old.json"), "old");
    const second = createRunDirectory(config, tmp);
    expect(second.runId).not.toBe(first.runId);
    expect(fs.readFileSync(path.join(first.runDir, "old.json"), "utf8")).toBe("old");
    expect(createPageObservation(config.url, { name: "pc", width: 1280, height: 900 }).evidence_file)
      .not.toBe(createPageObservation(config.url, { name: "sp", width: 390, height: 844 }).evidence_file);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

test("正常・404・範囲外redirectを保存し、フォーム送信しない", async () => {
  test.setTimeout(60000);
  const methods: string[] = [];
  const server = http.createServer((req, res) => {
    methods.push(`${req.method} ${req.url}`);
    if (req.url === "/redirect") { res.writeHead(302, { Location: "http://localhost:1/outside" }); res.end(); return; }
    if (req.url === "/action-redirect") { res.writeHead(302, { Location: "/logout" }); res.end(); return; }
    if (req.url === "/missing") { res.writeHead(404, { "Content-Type": "text/html" }); res.end("<h1>Not found</h1>"); return; }
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end('<html lang="ja"><head><title>ローカルデモ</title></head><body><h1>公開デモ</h1><a href="/missing">欠落</a><a href="/redirect">範囲外</a><a href="/action-redirect">除外先</a><form method="post" action="/submit"><label for="name">名前</label><input id="name"><button>送信</button></form></body></html>');
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("fixture server unavailable");
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lgwi-run-"));
  try {
    const config = createInitialConfig(`http://127.0.0.1:${address.port}/`, { allow_local: true, delay_ms: 0, timeout_ms: 3000 });
    const { runDir, manifest } = await runInitialInspection(config, tmp);
    expect(manifest.status).toBe("partial");
    expect(manifest.pages.find(page => page.requested_url === config.url)?.checks.forms.status).toBe("complete");
    expect(manifest.pages.find(page => page.requested_url.endsWith("/missing"))?.open?.http_status).toBe(404);
    expect(manifest.pages.find(page => page.requested_url.endsWith("/redirect"))?.state).toBe("failed");
    expect(methods.every(item => item.startsWith("GET "))).toBe(true);
    expect(methods.some(item => item.includes("/submit"))).toBe(false);
    expect(methods.some(item => item.includes("/logout"))).toBe(false);
    for (const page of manifest.pages) expect(fs.existsSync(path.join(runDir, page.evidence_file))).toBe(true);
    expect(JSON.parse(fs.readFileSync(path.join(runDir, "manifest.json"), "utf8")).finished_at).not.toBeNull();
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("CLIの実行方式でもブラウザ内のフォーム収集関数が動く", async () => {
  test.setTimeout(60000);
  const server = http.createServer((_req, res) => {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end('<html lang="ja"><title>CLI demo</title><form><label for="name">名前</label><input id="name" required></form></html>');
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("fixture server unavailable");
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lgwi-cli-"));
  try {
    await promisify(execFile)(process.execPath, ["dist/scripts/inspect-initial.js", `http://127.0.0.1:${address.port}/`, "--allow-local", "--no-pdf", "--output", tmp], { timeout: 45000 });
    const site = fs.readdirSync(tmp)[0]!;
    const run = fs.readdirSync(path.join(tmp, site))[0]!;
    const manifest = JSON.parse(fs.readFileSync(path.join(tmp, site, run, "manifest.json"), "utf8"));
    expect(manifest.status).toBe("complete");
    expect(manifest.pages[0].checks.forms.data[0].fields[0].label_text).toBe("名前");
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("公開範囲外の接続失敗も未完了台帳を保存する", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lgwi-failed-"));
  try {
    const { runDir, manifest } = await runInitialInspection(createInitialConfig("http://127.0.0.1/"), tmp);
    expect(manifest.status).toBe("failed");
    expect(manifest.pages).toHaveLength(2);
    expect(manifest.pages.every(page => page.checks.meta.status === "not_run")).toBe(true);
    expect(fs.existsSync(path.join(runDir, "manifest.json"))).toBe(true);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});
