import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { createInitialConfig } from "../helpers/initial-config";
import { runInitialInspection, saveInitialJson } from "../helpers/initial-inspection";
import { buildInitialReportContent } from "../helpers/initial-findings";
import { renderInitialReport } from "../helpers/initial-report-renderer";

async function main(): Promise<void> {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      config: { type: "string" }, output: { type: "string" },
      "max-pages": { type: "string" }, "allow-local": { type: "boolean" },
      "no-pdf": { type: "boolean" }, help: { type: "boolean", short: "h" },
    },
  });
  if (values.help || positionals.length !== 1) {
    console.log("npm run inspect -- <public-url> [--config config.json] [--max-pages 5] [--output reports] [--no-pdf]");
    console.log("URLだけで実行可能。--allow-local は自分のlocalhostデモ専用。フォーム送信は行いません。");
    if (!values.help) process.exitCode = 1;
    return;
  }
  const extra = values.config ? JSON.parse(fs.readFileSync(values.config, "utf8")) : {};
  const config = createInitialConfig(positionals[0]!, {
    ...extra,
    ...(values["max-pages"] ? { max_pages: Number(values["max-pages"]) } : {}),
    allow_local: values["allow-local"] === true,
  });
  const { runDir, manifest } = await runInitialInspection(config, values.output);
  const content = buildInitialReportContent(manifest);
  saveInitialJson(path.join(runDir, "report-content.json"), content);
  if (!values["no-pdf"]) await renderInitialReport(runDir, manifest, content);
  console.log(JSON.stringify({ run_id: manifest.run_id, status: manifest.status, directory: runDir, owner_review: content.owner_review }, null, 2));
  if (manifest.status === "failed" || manifest.status === "interrupted") process.exitCode = 2;
}

main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
