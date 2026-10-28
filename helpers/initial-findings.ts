import { createHash } from "node:crypto";

import type {
  InitialFinding,
  InitialReportContent,
  InitialRunManifest,
  ObservationCheck,
  PageObservation,
  ReportPoint,
} from "../types/initial-report";

type FindingDraft = Pick<
  InitialFinding,
  "rule" | "title" | "priority" | "priority_reason" | "hypothesis" | "question" | "next_action"
>;

interface FindingGroup {
  draft: FindingDraft;
  page_url: string;
  pages: PageObservation[];
  observations: string[];
}

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 } as const;
const RULE_ORDER = ["horizontal-overflow", "broken-image", "form-label", "missing-title", "missing-language"];

/** 取得完了の検査データだけを返し、失敗や未実施はnullとして扱う。 */
function completedData<T>(check: ObservationCheck<T>): T | null {
  return check.status === "complete" ? check.data : null;
}

/** 到達成功かつHTTP 2xxの観測で、改善候補の判定に使えるページか確認する。 */
function hasUsablePage(page: PageObservation): boolean {
  const status = page.open?.http_status;
  return (
    (page.state === "complete" || page.state === "partial") &&
    page.open?.opened === true &&
    page.open.http_ok === true &&
    typeof status === "number" && status >= 200 && status < 300
  );
}

/** リダイレクト後のURLを返し、未取得なら要求時のURLを使う。 */
function pageUrl(page: PageObservation): string {
  return page.open?.final_url ?? page.requested_url;
}

/** 空白を整え、指定文字数を超える文字列を省略記号付きで短縮する。 */
function shortText(value: string, maxLength = 180): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length <= maxLength ? normalized : `${normalized.slice(0, maxLength - 1)}…`;
}

/** 画像の参照先を短く表示し、埋め込み画像の長いデータは説明に置き換える。 */
function imageLabel(value: string): string {
  return value.startsWith("data:") ? "埋め込み画像（詳細は観測JSON）" : shortText(value);
}

/** 観測したPC・スマートフォンの表示幅を読みやすい文字列にする。 */
function conditionLabel(page: PageObservation): string {
  return `${page.viewport.name === "pc" ? "PC幅" : "スマートフォン幅"}${page.viewport.width}px`;
}

/** 配列の順序を保ちながら重複する値を取り除く。 */
function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

/** 指摘の種類に合う証拠画像を、保存済みの画像から優先順に選ぶ。 */
function screenshotFor(page: PageObservation, rule: string): string | null {
  if (rule === "form-label") {
    return page.screenshots.form ?? page.screenshots.viewport ?? page.screenshots.full;
  }
  if (rule === "broken-image") {
    return page.screenshots.full ?? page.screenshots.viewport;
  }
  return page.screenshots.viewport ?? page.screenshots.full;
}

/** 同じURL・同じ検査ルールの指摘をまとめ、重複しない観測と証拠を追加する。 */
function addFinding(
  groups: Map<string, FindingGroup>,
  page: PageObservation,
  draft: FindingDraft,
  observation: string,
): void {
  const url = pageUrl(page);
  const key = `${draft.rule}\n${url}`;
  let group = groups.get(key);
  if (!group) {
    group = { draft, page_url: url, pages: [], observations: [] };
    groups.set(key, group);
  }
  if (!group.pages.some((existing) => existing.id === page.id)) {
    group.pages.push(page);
    group.observations.push(`${conditionLabel(page)}：${observation}`);
  }
}

/** 1ページの取得済みデータを5つのルールで調べ、確認候補を集める。 */
function collectPageFindings(groups: Map<string, FindingGroup>, page: PageObservation): void {
  const layout = completedData(page.checks.layout);
  if (
    layout?.horizontal_overflow === true &&
    Number.isFinite(layout.document_width) && Number.isFinite(layout.viewport_width) &&
    layout.viewport_width > 0 && layout.document_width > layout.viewport_width + 1
  ) {
    addFinding(groups, page, {
      rule: "horizontal-overflow",
      title: "横方向にはみ出している表示範囲を確認する",
      priority: "medium",
      priority_reason: "実際の表示寸法に差があり、内容の見やすさに関係するため、画面を確認します。",
      hypothesis: "画面幅より広い画像・表・固定幅の要素が、内容を読む操作を増やしている可能性があります。意図した横スクロールの可能性もあります。",
      question: "この横方向の広がりは意図した表示ですか。主要な文章やボタンが見切れていないか確認できますか。",
      next_action: "証拠画像と該当幅のブラウザ表示を確認し、原因の要素を特定してから、幅指定や画像・表の表示方法を調整します。",
    }, `表示幅${layout.viewport_width}pxに対して、ページ全体の幅を${layout.document_width}pxと観測しました。差は${layout.document_width - layout.viewport_width}pxです。`);
  }

  const images = completedData(page.checks.images);
  const broken = images?.filter((item) => item.load_status === "broken") ?? [];
  if (broken.length > 0) {
    const examples = broken.slice(0, 5).map((item) =>
      `img #${item.order}「${imageLabel(item.current_src || item.src || "URL未取得")}」（実寸${item.natural_width}×${item.natural_height}）`,
    );
    addFinding(groups, page, {
      rule: "broken-image",
      title: "読み込みを確認できなかった画像を再確認する",
      priority: "medium",
      priority_reason: "画像の表示に関わる観測結果のため、再表示で再現するかを先に確認します。",
      hypothesis: "画像URL、配信側の応答、一時的な通信条件等によって、画像の内容が表示されない可能性があります。利用者側でも同じ状態かは未確認です。",
      question: "同じページを通常のブラウザで再表示しても、これらの画像が表示されない状態になりますか。",
      next_action: "該当画像のURLと再現性を確認し、必要に応じて画像ファイル・参照先・配信設定を修正します。",
    }, `取得したimg要素のうち${broken.length}件を、画像Inspectorが「broken」に分類しました。${examples.join("、")}${broken.length > examples.length ? "。ほかの対象は観測JSONに記録しています。" : "。"}`);
  }

  const forms = completedData(page.checks.forms);
  const missingLabels = forms?.flatMap((form) => form.fields
    .filter((field) => field.label_status === "missing" && !field.disabled && field.input_type !== "hidden")
    .map((field) => ({ form, field }))) ?? [];
  if (missingLabels.length > 0) {
    const examples = missingLabels.slice(0, 5).map(({ form, field }) =>
      `form #${form.order}・項目 #${field.order}（${shortText(field.name || field.id || field.input_type || field.element, 70)}）`,
    );
    addFinding(groups, page, {
      rule: "form-label",
      title: "入力欄と項目名の関連付けを確認する",
      priority: "medium",
      priority_reason: "入力欄の意味を伝える情報に関係するため、表示状態と項目名の関連付けを確認します。",
      hypothesis: "項目名の関連付けが不足している場合、入力欄の意味を把握しにくくなる可能性があります。別の命名方法や非表示の入力欄については追加確認が必要です。",
      question: "対象の入力欄は利用者に表示されますか。表示された項目名や読み上げ時の名前が、対応する入力欄に結び付いていますか。",
      next_action: "対象欄の表示と実際の名前を確認し、必要であればlabel要素や適切なARIA属性を関連付けます。送信テストは別途扱います。",
    }, `既存Inspectorのlabel・aria-label・aria-labelledby確認で、無効化されていない入力欄${missingLabels.length}件のラベル文字列を取得できませんでした。${examples.join("、")}${missingLabels.length > examples.length ? "。ほかの対象は観測JSONに記録しています。" : "。"}`);
  }

  const meta = completedData(page.checks.meta);
  if (meta && (!meta.title_found || meta.title_text.trim() === "")) {
    addFinding(groups, page, {
      rule: "missing-title",
      title: "ページタイトルの設定を確認する",
      priority: "low",
      priority_reason: "ページを識別する基本情報の確認候補です。アクセスや売上への影響は未測定です。",
      hypothesis: "ブラウザのタブ等でページの内容が伝わりにくくなる可能性があります。検索順位や売上への影響は、この観測だけでは判断できません。",
      question: "このページの役割が分かるタイトルを、どのような名称で表示したいですか。",
      next_action: "ページの内容に合ったタイトルを設定し、通常表示と生成後のHTMLで確認します。",
    }, meta.title_found ? "title要素は存在しますが、取得した文字列は空でした。" : "取得時のDOMでhead直下のtitle要素を確認できませんでした。");
  }
  if (meta && (!meta.html_lang_found || (meta.html_lang ?? "").trim() === "")) {
    addFinding(groups, page, {
      rule: "missing-language",
      title: "ページの言語指定を確認する",
      priority: "low",
      priority_reason: "読み上げ等の言語処理に関係する基本設定の確認候補です。実際の利用環境での影響は未確認です。",
      hypothesis: "ページの言語が機械に伝わらず、読み上げ等で適切な言語処理が選ばれない可能性があります。",
      question: "このページの主な言語は何ですか。別の属性による指定や、多言語の運用がありますか。",
      next_action: "HTMLの種類とページの主な言語を確認し、適切なlang属性の指定を検討します。",
    }, meta.html_lang_found ? "html要素のlang属性は存在しますが、取得した値は空でした。" : "取得時のDOMでhtml要素のlang属性を確認できませんでした。");
  }
}

/** 重複を除いたページ数と表示条件数を、説明用の文字列にする。 */
function scopeText(pages: PageObservation[]): string {
  return `${unique(pages.map(pageUrl)).length}ページ・${pages.length}表示条件`;
}

/** 到達・タイトル・画像・横幅の観測から、根拠付きで確認できた良い点を作る。 */
function buildStrengths(pages: PageObservation[]): ReportPoint[] {
  const strengths: ReportPoint[] = [];
  /** 該当する観測がある場合だけ、良い点の文章と重複しない証拠IDを追加する。 */
  const add = (matched: PageObservation[], text: string): void => {
    if (matched.length > 0) strengths.push({ text, evidence_ids: unique(matched.map((page) => page.id)) });
  };
  add(pages, `${scopeText(pages)}でHTTP 2xxの応答を受け、ページへの到達を確認しました。`);

  const titled = pages.filter((page) => {
    const data = completedData(page.checks.meta);
    return data?.title_found === true && data.title_text.trim() !== "";
  });
  add(titled, `${scopeText(titled)}で、空でないページタイトルを取得できました。`);

  const loadedImages = pages.filter((page) => {
    const data = completedData(page.checks.images);
    return data !== null && data.length > 0 && data.every((item) => item.load_status === "loaded");
  });
  add(loadedImages, `${scopeText(loadedImages)}で取得したimg要素は、すべてブラウザが画像の実寸を取得できた状態でした。CSSの背景画像などはこの確認に含みません。`);

  const contained = pages.filter((page) => {
    const data = completedData(page.checks.layout);
    return data !== null && data.horizontal_overflow === false &&
      Number.isFinite(data.viewport_width) && Number.isFinite(data.document_width) &&
      data.viewport_width > 0 && data.document_width > 0 && data.document_width <= data.viewport_width;
  });
  add(contained, `${scopeText(contained)}で、測定したページ全体の幅が表示幅を超えていないことを確認しました。`);
  return strengths;
}

/** 観測事実から確認候補と良い点をまとめ、所有者レビュー前のレポート内容を作る。 */
export function buildInitialReportContent(manifest: InitialRunManifest): InitialReportContent {
  const usablePages = manifest.pages.filter(hasUsablePage);
  const groups = new Map<string, FindingGroup>();
  for (const page of usablePages) collectPageFindings(groups, page);

  const findings: InitialFinding[] = [...groups.entries()].map<InitialFinding>(([key, group]) => ({
    id: `${group.draft.rule}-${createHash("sha256").update(key).digest("hex").slice(0, 12)}`,
    ...group.draft,
    page_url: group.page_url,
    observation: group.observations.join("\n"),
    evidence_ids: group.pages.map((page) => page.id),
    evidence_files: unique(group.pages.map((page) => page.evidence_file)),
    screenshot: group.pages.map((page) => screenshotFor(page, group.draft.rule)).find((path) => path !== null) ?? null,
    review_status: "unreviewed",
    review_note: null,
  })).sort((left, right) =>
    PRIORITY_ORDER[left.priority] - PRIORITY_ORDER[right.priority] ||
    RULE_ORDER.indexOf(left.rule) - RULE_ORDER.indexOf(right.rule) ||
    left.page_url.localeCompare(right.page_url),
  );

  const incomplete = manifest.pages.filter((page) => page.state !== "complete").length;
  const questions: string[] = [];
  if (!manifest.config.purpose?.trim()) questions.push("このサイトで最優先に増やしたい成果は、問い合わせ・申込み・予約などのどれですか。");
  if (!manifest.config.concern?.trim()) questions.push("現在気になっている表示や操作、利用者から指摘されていることはありますか。");
  questions.push("今回の確認範囲以外に、優先して確認したいページや利用端末はありますか。");

  const content: InitialReportContent = {
    schema_version: 1,
    run_id: manifest.run_id,
    display_name: shortText(manifest.config.display_name, 300) || manifest.config.site_id,
    summary: `予定した${manifest.pages.length}表示条件のうち、${usablePages.length}条件でHTTP 2xxによるページ到達を確認しました。${findings.length > 0 ? `公開情報から抽出した改善確認候補は${findings.length}件です。候補の採用と優先順位は、画面と目的を確認して判断します。` : "今回完了した観測からは、設定済みの判定ルールに該当する改善確認候補は抽出されませんでした。"}${incomplete > 0 ? `一部未完了・未確認の表示条件が${incomplete}件あります。` : ""}フォームの送受信やアクセス・売上への影響は、この点検では確認していません。`,
    strengths: buildStrengths(usablePages),
    findings,
    questions,
    owner_review: "pending",
    reviewer_note: null,
  };
  validateReportContent(manifest, content);
  return content;
}

/** 検証に失敗した項目名と理由を含む例外を投げる。 */
function invalid(path: string, message: string): never {
  throw new Error(`レポート検証エラー: ${path} ${message}`);
}

/** 値が配列やnullではないオブジェクトであることを検証する。 */
function objectValue(value: unknown, path: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) invalid(path, "はオブジェクトにしてください。");
  return value as Record<string, unknown>;
}

/** 値が空白だけでない文字列で、指定した文字数以内か検証する。 */
function textValue(value: unknown, path: string, maxLength: number): string {
  if (typeof value !== "string" || value.trim() === "" || value.length > maxLength) {
    invalid(path, `は空でない${maxLength}文字以内の文字列にしてください。`);
  }
  return value;
}

/** nullを許可し、それ以外は空白だけでない文字列と文字数上限を検証する。 */
function nullableText(value: unknown, path: string, maxLength: number): void {
  if (value !== null) textValue(value, path, maxLength);
}

/** 値が配列で、指定した件数以内であることを検証する。 */
function arrayValue(value: unknown, path: string, maxItems: number): unknown[] {
  if (!Array.isArray(value) || value.length > maxItems) invalid(path, `は${maxItems}件以内の配列にしてください。`);
  return value;
}

/** 値が許可された文字列の選択肢に含まれることを検証する。 */
function enumValue(value: unknown, path: string, allowed: string[]): void {
  if (typeof value !== "string" || !allowed.includes(value)) invalid(path, `は${allowed.join(" / ")}のいずれかにしてください。`);
}

/** 証拠ファイルの参照が、実行フォルダ内を指す安全な相対パスか検証する。 */
function relativeFile(value: unknown, path: string): string {
  const result = textValue(value, path, 2048);
  if (/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(result) || result.startsWith("/") || result.includes("\\") ||
    result.split("/").some((part) => part === ".." || part === "." || part === "") || /[\u0000-\u001f]/.test(result)) {
    invalid(path, "は実行フォルダ内の安全な相対ファイルパスにしてください。");
  }
  return result;
}

/** 重複のない証拠IDを検証し、今回の実行に属する観測へ対応付ける。 */
function evidencePages(value: unknown, path: string, pages: Map<string, PageObservation>): PageObservation[] {
  const ids = arrayValue(value, path, 500).map((item, index) => textValue(item, `${path}[${index}]`, 200));
  if (ids.length === 0 || unique(ids).length !== ids.length) invalid(path, "は重複のない証拠IDを1件以上指定してください。");
  return ids.map((id) => {
    const page = pages.get(id);
    if (!page) invalid(path, `に今回の実行に存在しない証拠ID「${id}」があります。`);
    return page;
  });
}

/** 編集したレポートJSONの項目と証拠参照が、今回の実行記録と整合するか検証する。 */
export function validateReportContent(manifest: InitialRunManifest, content: unknown): void {
  const record = objectValue(content, "report");
  let serialized: string;
  try { serialized = JSON.stringify(content); } catch { invalid("report", "はJSONとして保存できる内容にしてください。"); }
  if (serialized.length > 400_000) invalid("report", "全体は400000文字以内にしてください。");
  if (record.schema_version !== 1) invalid("schema_version", "は1にしてください。");
  if (record.run_id !== manifest.run_id) invalid("run_id", "が今回の実行IDと一致しません。");
  textValue(record.display_name, "display_name", 300);
  textValue(record.summary, "summary", 6000);
  enumValue(record.owner_review, "owner_review", ["pending", "completed"]);
  nullableText(record.reviewer_note, "reviewer_note", 6000);

  const pages = new Map(manifest.pages.map((page) => [page.id, page]));
  const strengths = arrayValue(record.strengths, "strengths", 30);
  strengths.forEach((value, index) => {
    const path = `strengths[${index}]`;
    const point = objectValue(value, path);
    textValue(point.text, `${path}.text`, 2000);
    evidencePages(point.evidence_ids, `${path}.evidence_ids`, pages);
  });
  arrayValue(record.questions, "questions", 30).forEach((value, index) => textValue(value, `questions[${index}]`, 2000));

  const findingIds = new Set<string>();
  arrayValue(record.findings, "findings", 200).forEach((value, index) => {
    const path = `findings[${index}]`;
    const finding = objectValue(value, path);
    const id = textValue(finding.id, `${path}.id`, 200);
    if (findingIds.has(id)) invalid(`${path}.id`, "が重複しています。");
    findingIds.add(id);
    textValue(finding.rule, `${path}.rule`, 100);
    textValue(finding.title, `${path}.title`, 300);
    textValue(finding.priority_reason, `${path}.priority_reason`, 2000);
    textValue(finding.observation, `${path}.observation`, 10000);
    textValue(finding.hypothesis, `${path}.hypothesis`, 4000);
    textValue(finding.question, `${path}.question`, 4000);
    textValue(finding.next_action, `${path}.next_action`, 4000);
    enumValue(finding.priority, `${path}.priority`, ["high", "medium", "low"]);
    enumValue(finding.review_status, `${path}.review_status`, ["unreviewed", "confirmed", "deferred", "dismissed"]);
    nullableText(finding.review_note, `${path}.review_note`, 6000);

    const referenced = evidencePages(finding.evidence_ids, `${path}.evidence_ids`, pages);
    const url = textValue(finding.page_url, `${path}.page_url`, 8192);
    if (!referenced.every((page) => page.requested_url === url || page.open?.final_url === url)) {
      invalid(`${path}.page_url`, "が参照した証拠ページのURLと一致しません。");
    }
    const files = arrayValue(finding.evidence_files, `${path}.evidence_files`, 500)
      .map((file, fileIndex) => relativeFile(file, `${path}.evidence_files[${fileIndex}]`));
    const expectedFiles = new Set(referenced.map((page) => page.evidence_file));
    if (unique(files).length !== files.length || files.length !== expectedFiles.size || files.some((file) => !expectedFiles.has(file))) {
      invalid(`${path}.evidence_files`, "が証拠IDに対応する今回のファイルと一致しません。");
    }
    if (finding.screenshot !== null) {
      const screenshot = relativeFile(finding.screenshot, `${path}.screenshot`);
      if (!referenced.some((page) => Object.values(page.screenshots).includes(screenshot))) {
        invalid(`${path}.screenshot`, "は参照した証拠ページの画像から選んでください。");
      }
    }
  });
}
