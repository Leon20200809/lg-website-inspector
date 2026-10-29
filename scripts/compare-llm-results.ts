import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";
import { compareLlmResults, readVerifiedLlmCase, stableJson, validateLlmResult } from "../helpers/llm-evaluation";

/** 同一入力に対する二つの応答を検証し、引用・分類・優先順位の違いを出力する。 */
function main(): void {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: { output: { type: "string" }, help: { type: "boolean", short: "h" } } });
  if (values.help || positionals.length !== 3) {
    console.log("npm run llm:compare -- <case-directory> <result-a.json> <result-b.json> [--output comparison.json]");
    console.log("Markdown を除いた JSON を保存してください。意味の正しさは自動採点しません。");
    if (!values.help) process.exitCode = 1;
    return;
  }
  const context = readVerifiedLlmCase(path.resolve(positionals[0]!));
  const a = validateLlmResult(JSON.parse(fs.readFileSync(positionals[1]!, "utf8")), context);
  const b = validateLlmResult(JSON.parse(fs.readFileSync(positionals[2]!, "utf8")), context);
  const text = stableJson(compareLlmResults(a, b));
  if (values.output) {
    const destination = path.resolve(values.output);
    if (fs.existsSync(destination)) throw new Error("比較結果は既存ファイルへ上書きしません。別の --output を指定してください。");
    fs.mkdirSync(path.dirname(destination), { recursive: true });
    fs.writeFileSync(destination, text, "utf8");
  }
  console.log(text);
}

try { main(); } catch (error) { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }
