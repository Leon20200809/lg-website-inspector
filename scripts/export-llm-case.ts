import path from "node:path";
import { parseArgs } from "node:util";
import { exportLlmCase } from "../helpers/llm-evaluation";

/** 指定した実行の事実と共通プロンプトを持ち運べる実験入力へ保存する。 */
function main(): void {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: { output: { type: "string" }, supplement: { type: "string" }, help: { type: "boolean", short: "h" } } });
  if (values.help || positionals.length !== 1) {
    console.log("npm run llm:export -- <run-directory> [--output case-directory] [--supplement observations.json]");
    console.log("input.txt を各 LLM の新しい会話へ渡し、応答 JSON と実験設定を保存してください。外部 API は呼び出しません。");
    if (!values.help) process.exitCode = 1;
    return;
  }
  const runDir = path.resolve(positionals[0]!);
  const outputDir = path.resolve(values.output ?? path.join(runDir, "llm-evaluation"));
  const manifest = exportLlmCase(runDir, outputDir, path.resolve("prompts"), values.supplement);
  console.log(JSON.stringify({ directory: outputDir, case_id: manifest.case_id, case_sha256: manifest.case_sha256, facts_sha256: manifest.files["facts.json"], input_sha256: manifest.files["input.txt"] }, null, 2));
}

try { main(); } catch (error) { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }
