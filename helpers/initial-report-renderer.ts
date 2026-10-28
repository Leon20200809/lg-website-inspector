import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";
import MarkdownIt from "markdown-it";

import type {
  InitialFinding,
  InitialReportContent,
  InitialRunManifest,
  PageObservation,
} from "../types/initial-report";
import { validateReportContent } from "./initial-findings";

interface ReportImage {
  relativePath: string;
  markdownPath: string;
  dataUrl: string;
}

interface ReportPaths {
  markdownPath: string;
  htmlPath: string;
  pdfPath: string;
}

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 } as const;
const PRIORITY_LABEL = { high: "優先して確認", medium: "順に確認", low: "参考" } as const;
const PAGE_STATE_LABEL: Record<PageObservation["state"], string> = {
  pending: "未実施",
  complete: "取得完了",
  partial: "一部未確認",
  failed: "取得失敗",
  skipped: "未実施",
};

/** Keep website-derived strings as text, including in the editable Markdown source. */
function markdownText(value: string): string {
  return value.replace(/[\r\n]+/g, " ").replace(/[\\`*_{}\[\]()#+.!|>~<-]/g, "\\$&");
}

function htmlText(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    };
    return entities[character] ?? character;
  });
}

function formatJapanTime(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error("実行日時を読み取れません。");
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).format(date) + " JST";
}

function pageLabel(value: string): string {
  const url = new URL(value);
  return url.pathname === "/" && !url.search ? "トップページ" : `${url.pathname}${url.search}`;
}

function sameUrl(first: string, second: string): boolean {
  const left = new URL(first);
  const right = new URL(second);
  left.hash = "";
  right.hash = "";
  return left.href === right.href;
}

function scopeReasonLabel(reason: string): string {
  const labels: Record<string, string> = {
    "許可origin外": "同じサイトの外",
    "HTMLページ以外": "PDF・画像等",
    "指定除外URL": "確認対象から除外したページ",
  };
  return labels[reason] ?? reason;
}

/** Reject absolute paths, traversal, and symlinks escaping this run. */
async function resolveRunFile(runDir: string, relativePath: string): Promise<string> {
  if (!relativePath || relativePath.includes("\\") || relativePath.includes("\0") ||
    path.posix.isAbsolute(relativePath) || path.win32.isAbsolute(relativePath) ||
    relativePath.split("/").some((segment) => segment === ".." || segment === "")) {
    throw new Error(`run内の相対ファイルを指定してください: ${relativePath}`);
  }
  const resolved = await fs.realpath(path.resolve(runDir, relativePath));
  const relative = path.relative(runDir, resolved);
  if (!relative || relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`run外の証拠ファイルは使用できません: ${relativePath}`);
  }
  if (!(await fs.stat(resolved)).isFile()) throw new Error(`証拠がファイルではありません: ${relativePath}`);
  return resolved;
}

async function readImage(runDir: string, relativePath: string): Promise<ReportImage> {
  const resolved = await resolveRunFile(runDir, relativePath);
  const bytes = await fs.readFile(resolved);
  let mime: string;
  if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    mime = "image/png";
  } else if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) {
    mime = "image/jpeg";
  } else if (bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WEBP") {
    mime = "image/webp";
  } else {
    throw new Error(`PNG・JPEG・WebP以外の画像は使用できません: ${relativePath}`);
  }
  return {
    relativePath,
    markdownPath: relativePath.split("/").map(encodeURIComponent).join("/"),
    dataUrl: `data:${mime};base64,${bytes.toString("base64")}`,
  };
}

function topFindings(content: InitialReportContent): InitialFinding[] {
  return content.findings.filter((finding) =>
    finding.review_status !== "dismissed" && finding.review_status !== "deferred",
  ).sort((first, second) => {
    const reviewed = Number(second.review_status === "confirmed") - Number(first.review_status === "confirmed");
    return reviewed || PRIORITY_ORDER[first.priority] - PRIORITY_ORDER[second.priority];
  }).slice(0, 3);
}

function scopeTable(manifest: InitialRunManifest): string {
  const rows = [...new Set(manifest.pages.map((page) => page.requested_url))].map((url) => {
    const state = (viewport: "pc" | "sp"): string => {
      const page = manifest.pages.find((item) => item.requested_url === url && item.viewport.name === viewport);
      if (!page) return "未実施";
      const status = page.open?.http_status;
      return `${PAGE_STATE_LABEL[page.state]}${status ? ` / HTTP ${status}` : ""}`;
    };
    return `| ${markdownText(pageLabel(url))} | ${state("pc")} | ${state("sp")} |`;
  });
  return ["| 確認したページ | PC幅 | スマホ幅 |", "| --- | --- | --- |", ...rows].join("\n");
}

function findingMarkdown(finding: InitialFinding, index: number): string {
  const status = finding.review_status === "confirmed" ? "観測確認済み" : "確認候補";
  const fields: [string, string][] = [
    ["観測したこと", finding.observation],
    ["考えられる影響（仮説）", finding.hypothesis],
    ["確認したいこと", finding.question],
    ["次の一手", finding.next_action],
  ];
  return [
    `### ${index + 1}. ${markdownText(finding.title)}`,
    `**${PRIORITY_LABEL[finding.priority]} / ${status}**`,
    `対象：${markdownText(pageLabel(finding.page_url))}`,
    ...fields.map(([label, value]) => `**${label}：** ${markdownText(value)}`),
    `優先する理由：${markdownText(finding.priority_reason)}`,
    ...(finding.review_note ? [`確認メモ：${markdownText(finding.review_note)}`] : []),
    `証拠番号：${finding.evidence_ids.map(markdownText).join("、")}`,
  ].join("\n\n");
}

const REPORT_CSS = `
  @page { size: A4; margin: 13mm 14mm 15mm; }
  * { box-sizing: border-box; }
  html { color: #20333d; background: #fff; font-family: "Noto Sans CJK JP", "Noto Sans JP", "Yu Gothic", "Hiragino Kaku Gothic ProN", sans-serif; }
  body { margin: 0; font-size: 9pt; line-height: 1.6; overflow-wrap: anywhere; }
  .report-page { break-before: page; }
  .report-page:first-child { break-before: auto; }
  .masthead { display: flex; justify-content: space-between; gap: 8mm; padding-bottom: 3mm; border-bottom: 1.5px solid #176d71; margin-bottom: 5mm; font-size: 7.5pt; color: #176d71; letter-spacing: .07em; }
  h1 { font-size: 23pt; line-height: 1.3; margin: 0 0 4mm; font-weight: 700; letter-spacing: -.025em; }
  h2 { font-size: 12pt; line-height: 1.45; margin: 5mm 0 2.5mm; padding-bottom: 1.4mm; border-bottom: .4px solid #ccd8db; break-after: avoid; }
  h3 { font-size: 11pt; line-height: 1.5; margin: 0 0 2mm; break-after: avoid; }
  p { margin: 0 0 2.3mm; }
  ul, ol { margin: 1.5mm 0 3mm; padding-left: 5mm; }
  li { margin: 0 0 1.5mm; }
  strong { font-weight: 700; }
  .client-name { font-size: 12pt; font-weight: 700; margin-bottom: 1mm; }
  .site-url, .small { font-size: 7.8pt; color: #536970; }
  .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5mm 5mm; padding: 3mm 0; margin-bottom: 2mm; font-size: 8pt; }
  .summary { padding: 3.5mm 4mm; background: #edf5f3; border-left: 2.5px solid #176d71; margin: 2mm 0 4mm; font-size: 10pt; line-height: 1.7; }
  .summary p:last-child { margin: 0; }
  .root-screenshots { display: grid; grid-template-columns: 1.8fr 1fr; gap: 4mm; align-items: start; margin: 2.5mm 0 4mm; break-inside: avoid; }
  figure { margin: 0; min-width: 0; }
  .root-screenshots .image-box { height: 57mm; background: #f6f8f8; border: 1px solid #dbe4e5; padding: 1.5mm; display: flex; align-items: center; justify-content: center; }
  img { display: block; max-width: 100%; height: auto; }
  .root-screenshots img { max-height: 53mm; object-fit: contain; }
  figcaption { margin-top: 1.5mm; font-size: 7pt; color: #5c6f75; }
  .image-unavailable { min-height: 20mm; background: #f6f8f8; border: 1px dashed #b8c9cd; padding: 4mm; color: #596e75; font-size: 8pt; }
  .finding { padding: 3mm 0 3.5mm; border-bottom: 1px solid #d8e1e3; break-inside: avoid; }
  .finding:first-of-type { padding-top: 1mm; }
  .finding-body { display: flow-root; }
  .finding p { margin-bottom: 1.7mm; font-size: 8.2pt; line-height: 1.6; }
  .finding figure { float: right; width: 39mm; padding-top: 1mm; margin: 0 0 2mm 4mm; }
  .finding figure img { max-height: 43mm; width: 100%; object-fit: contain; object-position: top; border: 1px solid #dbe4e5; }
  .priority { display: inline-block; padding: .6mm 2mm; background: #edf5f3; color: #185c60; font-size: 7.5pt; border-radius: 1mm; margin-bottom: 2mm; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; margin: 2mm 0 3mm; font-size: 7.7pt; }
  th, td { text-align: left; vertical-align: top; border-bottom: .5px solid #d8e1e3; padding: 2mm; overflow-wrap: anywhere; }
  th { background: #edf2f3; font-weight: 700; }
  th:first-child { width: 45%; }
  tr { break-inside: avoid; }
  thead { display: table-header-group; }
  .limitations { padding: 3mm 4mm; background: #f5f7f8; margin-top: 4mm; font-size: 8pt; }
  .limitations h2 { margin-top: 0; font-size: 10pt; }
  .limitations li { margin-bottom: 1mm; }
  .record { font-size: 7pt; color: #62747a; margin-top: 4mm; padding-top: 2mm; border-top: .5px solid #d8e1e3; }
  @media screen { body { max-width: 182mm; margin: 12mm auto; } .report-page { padding-bottom: 12mm; margin-bottom: 12mm; border-bottom: 1px solid #ccd8db; } }
  @media print { a { color: inherit; text-decoration: none; } }
`;

/** Render one saved run only. No website is visited during this operation. */
export async function renderInitialReport(
  runDir: string,
  manifest: InitialRunManifest,
  content: InitialReportContent,
): Promise<ReportPaths> {
  validateReportContent(manifest, content);
  const canonicalRunDir = await fs.realpath(path.resolve(runDir));
  if (!(await fs.stat(canonicalRunDir)).isDirectory()) throw new Error("runディレクトリを指定してください。");
  const savedManifest = JSON.parse(await fs.readFile(await resolveRunFile(canonicalRunDir, "manifest.json"), "utf8")) as { run_id?: unknown };
  if (savedManifest.run_id !== manifest.run_id) throw new Error("指定フォルダのmanifestと実行IDが一致しません。");

  // Every referenced evidence file must still belong to the selected run on disk.
  const evidenceFiles = new Set(content.findings.flatMap((finding) => finding.evidence_files));
  for (const strength of content.strengths) {
    for (const id of strength.evidence_ids) {
      const observation = manifest.pages.find((page) => page.id === id);
      if (observation) evidenceFiles.add(observation.evidence_file);
    }
  }
  for (const file of evidenceFiles) await resolveRunFile(canonicalRunDir, file);

  const findings = topFindings(content);
  const roots = (["pc", "sp"] as const).map((viewport) => {
    const observation = manifest.pages.find((page) => page.viewport.name === viewport && sameUrl(page.requested_url, manifest.config.url));
    return { viewport, observation, image: observation?.screenshots.viewport ?? null };
  });
  const availableImages = new Set(manifest.pages.flatMap((page) =>
    Object.values(page.screenshots).filter((image): image is string => image !== null),
  ));
  const requiredImages = new Set([
    ...roots.map((root) => root.image),
    ...content.findings.map((finding) => finding.screenshot),
  ].filter((image): image is string => image !== null));
  const images = new Map<string, ReportImage>();
  for (const relativePath of requiredImages) {
    if (!availableImages.has(relativePath)) throw new Error(`manifestにない画像は使用できません: ${relativePath}`);
    images.set(relativePath, await readImage(canonicalRunDir, relativePath));
  }

  const md = new MarkdownIt({ html: false, linkify: false, breaks: false });
  const markdownImage = (relativePath: string, alt: string): string => {
    const image = images.get(relativePath);
    if (!image) throw new Error(`確認済み画像がありません: ${relativePath}`);
    return `![${markdownText(alt)}](<${image.markdownPath}>)`;
  };
  md.renderer.rules.image = (tokens, index) => {
    const token = tokens[index];
    const image = [...images.values()].find((item) => item.markdownPath === token?.attrGet("src"));
    if (!image) throw new Error("確認済み画像以外の参照を検出しました。");
    return `<img src="${image.dataUrl}" alt="${htmlText(token?.content ?? "確認画面")}">`;
  };

  const reportDate = formatJapanTime(manifest.started_at);
  const period = manifest.finished_at ? `${reportDate} 〜 ${formatJapanTime(manifest.finished_at)}` : `${reportDate}（終了時刻未記録）`;
  const ownerStatus = content.owner_review === "completed" ? "レビュー反映版" : "レビュー用・提出前";
  const uniquePages = new Set(manifest.pages.map((page) => page.requested_url)).size;
  const completeCount = manifest.pages.filter((page) => page.state === "complete").length;
  const eligibleCount = content.findings.filter((finding) => finding.review_status !== "dismissed" && finding.review_status !== "deferred").length;
  const strengthsMarkdown = content.strengths.length
    ? content.strengths.map((point) => `- ${markdownText(point.text)}`).join("\n")
    : "取得できた範囲では、強みとして提示できる材料をまだ確認できていません。";
  const priorityMarkdown = findings.length
    ? findings.map((finding, index) => `${index + 1}. **${markdownText(finding.title)}** — ${markdownText(finding.priority_reason)}`).join("\n")
    : "取得できた範囲では、優先して提示する確認候補はありません。未確認の操作・範囲は、後半の点検範囲に記載しています。";
  const rootMarkdown = roots.map((root) => {
    const label = root.viewport === "pc" ? "PC幅" : "スマホ幅";
    const dimensions = root.observation ? `${root.observation.viewport.width} × ${root.observation.viewport.height}px` : "条件未記録";
    const caption = `${label} / ${dimensions}${root.observation ? ` / ${root.observation.id}` : ""}`;
    return { ...root, caption, markdown: root.image ? markdownImage(root.image, caption) : `${label}の画像は取得できていません。` };
  });
  const findingMarkdowns = findings.map((finding, index) => ({
    finding,
    markdown: findingMarkdown(finding, index),
    imageMarkdown: finding.screenshot ? markdownImage(finding.screenshot, `${finding.id}の確認画面`) : "",
  }));
  const questionsMarkdown = content.questions.length
    ? content.questions.map((question) => `- ${markdownText(question)}`).join("\n")
    : "サイトの目的と、現在もっとも気になっている点をお聞かせください。";
  const nextMarkdown = findings.length
    ? findings.map((finding, index) => `${index + 1}. ${markdownText(finding.next_action)}`).join("\n")
    : "ご担当者へのヒアリング後に、追加確認の必要性と範囲を決めます。";
  const excludedReasons = new Map<string, number>();
  for (const scope of manifest.scope.filter((item) => !item.selected)) {
    const reason = scopeReasonLabel(scope.reason);
    excludedReasons.set(reason, (excludedReasons.get(reason) ?? 0) + 1);
  }
  const checkLabels = { meta: "ページ情報", forms: "フォーム構造", headings: "見出し", images: "画像", links: "リンク構造", layout: "横幅" };
  const unknownChecks = (Object.entries(checkLabels) as [keyof typeof checkLabels, string][]).flatMap(([key, label]) => {
    const count = manifest.pages.filter((page) => page.checks[key].status !== "complete").length;
    return count ? [`${label} ${count}表示条件`] : [];
  });
  const limitations = [...new Set([
    ...manifest.limitations,
    ...(unknownChecks.length ? [`未確認の検査項目：${unknownChecks.join("、")}。各ページの取得状況は上表に記載しています。`] : []),
    ...(excludedReasons.size ? [`今回対象外としたリンク先：${[...excludedReasons].map(([reason, count]) => `${reason} ${count}件`).join("、")}。`] : []),
    ...(manifest.status !== "complete" ? ["今回の点検には未完了の取得があります。取得できなかった範囲の状態は判断していません。"] : []),
  ])];
  const limitationsMarkdown = limitations.length
    ? limitations.map((limitation) => `- ${markdownText(limitation)}`).join("\n")
    : "本書に記載したページ・表示条件で取得できた公開画面を対象にしています。";
  const scopeMarkdown = scopeTable(manifest);
  const contextMarkdown = [
    `**サイトの目的：** ${markdownText(manifest.config.purpose ?? "未確認。初回ヒアリングで確認します。")}`,
    `**気になっている点：** ${markdownText(manifest.config.concern ?? "未確認。初回ヒアリングで確認します。")}`,
  ].join("\n\n");
  const selectionNote = eligibleCount > findings.length
    ? `本書には確認候補${eligibleCount}件のうち、優先する${findings.length}件を掲載しています。`
    : "観測事実と、事業への影響の仮説を分けて記載しています。";

  const markdown = [
    "# サイト初回点検レポート", markdownText(content.display_name), markdownText(manifest.config.url),
    `確認日時：${markdownText(period)}`, `確認状態：${ownerStatus}`,
    `対象：${uniquePages}ページ / 取得完了 ${completeCount}件（ページと表示条件の組み合わせ）`,
    "## 今回わかったこと", markdownText(content.summary),
    "## 確認できた良い点", strengthsMarkdown,
    "## 起点ページの表示", ...rootMarkdown.flatMap((root) => [root.markdown, markdownText(root.caption)]),
    "## 優先して確認したいこと", priorityMarkdown,
    ...(findingMarkdowns.length ? [
      "---", "## 画面から確認したこと", selectionNote,
      ...findingMarkdowns.flatMap((item) => [item.markdown, item.imageMarkdown]),
    ] : []),
    "---", "## 次に確認すること", contextMarkdown, questionsMarkdown,
    "## 小さく進める次の一手", nextMarkdown,
    "## 今回の点検範囲", scopeMarkdown,
    "取得完了は、記載した確認項目を取得したという意味です。サイト全体の正常性や事業成果を判定するものではありません。スマホ幅はChromiumによる画面幅の再現です。",
    "## この点検で未確認のこと", limitationsMarkdown,
    ...(content.reviewer_note ? ["## 確認者メモ", markdownText(content.reviewer_note)] : []),
    `確認記録：${markdownText(manifest.run_id)}`,
  ].filter(Boolean).join("\n\n") + "\n";

  const masthead = (section: string): string => `<div class="masthead"><span>LG WEBSITE INSPECTOR</span><span>${htmlText(section)}</span></div>`;
  const imageGrid = rootMarkdown.map((root) => `<figure>${root.image
    ? `<div class="image-box">${md.render(root.markdown)}</div>`
    : `<div class="image-unavailable">${htmlText(root.markdown)}</div>`}<figcaption>${htmlText(root.caption)}</figcaption></figure>`).join("");
  const cards = findingMarkdowns.map((item, index) => {
    const rendered = md.render(item.markdown);
    const headingEnd = rendered.indexOf("</h3>") + 5;
    const heading = rendered.slice(0, headingEnd);
    const details = rendered.slice(headingEnd);
    return `<article class="finding">${heading}<div class="finding-body">${item.imageMarkdown ? `<figure>${md.render(item.imageMarkdown)}<figcaption>確認画面 ${index + 1}</figcaption></figure>` : ""}<div>${details}</div></div></article>`;
  }).join("");
  const body = `
  <section class="report-page">${masthead("01 / 初回点検の概要")}
    <h1>サイト初回点検レポート</h1>
    <p class="client-name">${htmlText(content.display_name)}</p><p class="site-url">${htmlText(manifest.config.url)}</p>
    <div class="meta"><span>確認日時：${htmlText(reportDate)}</span><span>${htmlText(ownerStatus)}</span><span>対象：${uniquePages}ページ / PC幅・スマホ幅</span><span>取得完了：${completeCount}件 / ${manifest.pages.length}件</span></div>
    <div class="summary">${md.render(markdownText(content.summary))}</div>
    ${md.render("## 確認できた良い点\n\n" + strengthsMarkdown)}
    <h2>起点ページの表示</h2><div class="root-screenshots">${imageGrid}</div>
    ${md.render("## 優先して確認したいこと\n\n" + priorityMarkdown)}
    <p class="small">公開画面で確認できたことを整理しました。事業への影響は、ご担当者への確認が必要です。</p>
  </section>
  ${findings.length ? `<section class="report-page">${masthead("02 / 証拠と確認候補")}
    <h1>画面から確認したこと</h1><p class="small">${htmlText(selectionNote)}</p>
    ${cards}
  </section>` : ""}
  <section class="report-page">${masthead(`${findings.length ? "03" : "02"} / 次の一手と点検範囲`)}
    <h1>次に確認すること</h1>
    ${md.render(contextMarkdown + "\n\n" + questionsMarkdown)}
    ${md.render("## 小さく進める次の一手\n\n" + nextMarkdown)}
    ${md.render("## 今回の点検範囲\n\n" + scopeMarkdown)}
    <p class="small">取得完了は、記載した確認項目を取得したという意味です。サイト全体の正常性や事業成果を判定するものではありません。スマホ幅はChromiumによる画面幅の再現です。</p>
    <div class="limitations">${md.render("## この点検で未確認のこと\n\n" + limitationsMarkdown)}</div>
    ${content.reviewer_note ? md.render("## 確認者メモ\n\n" + markdownText(content.reviewer_note)) : ""}
    <p class="record">確認期間：${htmlText(period)}<br>確認記録：${htmlText(manifest.run_id)}</p>
  </section>`;
  const html = `<!DOCTYPE html><html lang="ja"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src 'none'; connect-src 'none'; base-uri 'none'; form-action 'none'"><title>${htmlText(content.display_name)} | サイト初回点検レポート</title><style>${REPORT_CSS}</style></head><body>${body}</body></html>`;
  const paths: ReportPaths = {
    markdownPath: path.join(canonicalRunDir, "report-source.md"),
    htmlPath: path.join(canonicalRunDir, "report-source.html"),
    pdfPath: path.join(canonicalRunDir, "report.pdf"),
  };
  await fs.writeFile(paths.markdownPath, markdown, "utf8");
  await fs.writeFile(paths.htmlPath, html, "utf8");
  // Never leave an older PDF beside updated sources if regeneration fails.
  await fs.rm(paths.pdfPath, { force: true });

  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined,
    args: ["--disable-background-networking", "--disable-component-update", "--disable-sync", "--no-first-run"],
  });
  try {
    const context = await browser.newContext({
      javaScriptEnabled: false, serviceWorkers: "block", offline: true,
      viewport: { width: 794, height: 1123 },
    });
    await context.route("**/*", (route) => route.abort());
    const page = await context.newPage();
    await page.emulateMedia({ media: "print" });
    await page.setContent(html, { waitUntil: "load", timeout: 30_000 });
    await page.evaluate(async () => { await document.fonts.ready; });
    const brokenImages = await page.locator("img").evaluateAll((elements) => elements.filter((element) =>
      !(element as HTMLImageElement).complete || (element as HTMLImageElement).naturalWidth === 0,
    ).map((element) => element.getAttribute("alt") ?? "画像"));
    if (brokenImages.length) throw new Error(`読み込めない画像があります: ${brokenImages.join("、")}`);
    const overflowing = await page.locator(".report-page").evaluateAll((sections) => sections.some((section) =>
      section.scrollWidth > section.clientWidth + 2,
    ));
    if (overflowing) throw new Error("用紙幅を超える内容があります。本文・画像・表を確認してください。");
    await page.pdf({
      path: paths.pdfPath, format: "A4", preferCSSPageSize: true, printBackground: true,
      displayHeaderFooter: true, headerTemplate: "<div></div>",
      footerTemplate: '<div style="font-family:sans-serif;font-size:8px;color:#62747a;width:100%;margin:0 14mm;display:flex;justify-content:space-between;"><span>LG Website Inspector</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>',
    });
  } finally {
    await browser.close();
  }
  return paths;
}
