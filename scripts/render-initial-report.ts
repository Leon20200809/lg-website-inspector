import fs from "node:fs/promises";
import path from "node:path";

import type { InitialReportContent, InitialRunManifest } from "../types/initial-report";
import { validateReportContent } from "../helpers/initial-findings";
import { renderInitialReport } from "../helpers/initial-report-renderer";

/** 指定した実行フォルダのJSONを読み込み、サイトを再取得せずレポートを再生成する。 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length !== 1 || !args[0] || args[0].startsWith("--")) {
    throw new Error("使用方法: npm run report:initial -- reports/<site>/<run>");
  }
  const runDir = path.resolve(args[0]);
  const manifest = JSON.parse(await fs.readFile(path.join(runDir, "manifest.json"), "utf8")) as InitialRunManifest;
  const content: unknown = JSON.parse(await fs.readFile(path.join(runDir, "report-content.json"), "utf8"));
  validateReportContent(manifest, content);
  const outputs = await renderInitialReport(runDir, manifest, content as InitialReportContent);
  console.log(`Markdown: ${outputs.markdownPath}`);
  console.log(`HTML: ${outputs.htmlPath}`);
  console.log(`PDF: ${outputs.pdfPath}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "初回レポートの生成に失敗しました。");
  process.exitCode = 1;
});
