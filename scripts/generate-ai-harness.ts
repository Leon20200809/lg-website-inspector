// 全部出力 npm run harness:ai
// ID指定 npm run harness:ai LazyGenius

import fs from "node:fs/promises";
import path from "node:path";
import type {
  LegacySmokeSummary,
  LegacyNavigationSummary,
} from "../types/legacy-report-summary";
import {
  SUMMARY_FILES,
  getReportDataDir,
  getSummaryJsonPath,
} from "../helpers/report-paths";

const AI_HARNESS_FILE = "ai-harness.md";

/**
 * JSONファイルを読み込んで、指定した型として返す。
 *
 * @param file_path 読み込むJSONファイルのパス
 * @returns パース済みのJSONデータ
 */
async function read_json<T>(file_path: string): Promise<T> {
  const file_body = await fs.readFile(file_path, "utf-8");

  return JSON.parse(file_body) as T;
}

/**
 * Markdown内にJSONを埋め込むため、読みやすい形に整形する。
 *
 * @param data JSON化したいデータ
 * @returns インデント付きJSON文字列
 */
function format_json(data: unknown): string {
  return JSON.stringify(data, null, 2);
}

/**
 * 指定サイトの ai-harness.md 保存先パスを取得する。
 *
 * ai-harness.md は data/ 配下ではなく、
 * reports/{site_id}/ai-harness.md に保存する。
 *
 * @param site_id レポート対象サイトID
 * @returns ai-harness.md の保存先パス
 */
function get_ai_harness_path(site_id: string): string {
  const data_dir = getReportDataDir(site_id);
  const report_dir = path.dirname(data_dir);

  return path.join(report_dir, AI_HARNESS_FILE);
}

/**
 * ai-harness.md の本文を生成する。
 *
 * @param smoke_summary 基本表示確認のJSON
 * @param navigation_summary リンク・導線確認のJSON
 * @returns AI投入用Markdown
 */
function build_ai_harness(
  smoke_summary: LegacySmokeSummary,
  navigation_summary: LegacyNavigationSummary,
): string {
  return `# Webサイト簡易確認レポート生成用ハーネス

## あなたの役割

あなたは、公開範囲で確認できたWebサイトの情報をもとに、読み手に配慮した「Webサイト簡易確認レポート」の文章を作成するAIです。

このレポートは、脆弱性診断や厳密なSEO診断ではありません。
公開ページを軽く確認した結果をもとに、改善提案の材料として使える文章を作成してください。

---

## 目的

以下の検査結果JSONをもとに、カジュアルかつ社会語寄りの簡易改善レポートを作成してください。

想定用途は以下です。

- 応募書類や紹介状に添える補足資料
- Webサイト改善提案のたたき台
- 保守・改善の会話を始めるための材料
- 自動検査結果を人間が読みやすい文章へ変換すること

---

## 重要な前提

この確認では、以下のみを行っています。

- トップページを開く
- title を取得する
- h1 の存在とテキストを確認する
- トップページ内のリンク情報を集計する
- PC/SPのスクリーンショットを取得する

以下は行っていません。

- 問い合わせフォームの自動送信
- ログイン領域へのアクセス
- 短時間の大量アクセス
- 負荷テスト
- 脆弱性診断
- サーバー内部の確認
- 厳密なSEO診断
- 全ページの網羅的チェック

したがって、見ていないことを断定しないでください。

---

## 表現ルール

### 避ける表現

以下のような強い断定や攻撃的な表現は避けてください。

- 問題があります
- 壊れています
- 修正すべきです
- SEO的に大きな損失です
- 致命的です
- セキュリティ上危険です
- ユーザー離脱の原因です
- 必ず改善してください

### 使ってよい表現

以下のような、やわらかい改善提案の表現を使ってください。

- 確認するとよさそうです
- 改善余地がありそうです
- 整理すると伝わりやすくなります
- 見直すと、より分かりやすくなりそうです
- 現時点では大きな不備は確認されませんでした
- 公開範囲の確認では、良好な状態に見えます
- 追加で確認すると、より正確に判断できそうです

---

## レポートの温度感

上から目線ではなく、相手に配慮した文章にしてください。

NG例：

> H1タグが空なのでSEO的に問題があります。

OK例：

> h1要素は確認できましたが、テキストは空文字として取得されました。ページの主題を伝える要素として、見出しテキストや画像altの設定を確認するとよさそうです。

---

## 入力データ

### smoke-summary.json

\`\`\`json
${format_json(smoke_summary)}
\`\`\`

### navigation-summary.json

\`\`\`json
${format_json(navigation_summary)}
\`\`\`

---

## JSONから安全に言えること

以下は、JSONの値から判断してよい内容です。

- トップページが表示できたか
- title が取得できたか
- title に想定キーワードが含まれていたか
- h1 要素が存在したか
- h1 テキストが取得できたか
- トップページ内のリンク総数
- ページ内アンカー数
- hrefなしリンク数
- #のみリンク数
- 電話リンク数
- メールリンク数
- PDFリンク数
- 内部リンク数
- 外部リンク数
- 要確認候補リンク数

---

## まだ断定してはいけないこと

以下は、このJSONだけでは断定しないでください。

- デザインが崩れている
- スマホで読みにくい
- CTAが弱い
- SEO対策が不十分
- meta description がない
- 画像altが設定されていない
- フォームが使いにくい
- 全ページのリンクが正常
- サイト全体の品質が高い/低い
- セキュリティに問題がある/ない

必要であれば、「追加で確認するとよさそうです」という表現にしてください。

---

## 特に見てほしい観点

### 1. h1テキスト

h1_exists が true で、h1_text が空文字の場合は、優先確認項目として扱ってください。

ただし、断定的に責めず、以下のような方向で提案してください。

- h1要素は確認できた
- ただし、テキストは空文字として取得された
- ロゴ画像をh1で囲んでいる可能性もある
- 見出しテキストや画像altの設定を確認するとよさそう
- ページの主題が検索エンジンや閲覧者に伝わりやすくなる可能性がある

### 2. リンク・導線

以下の値をもとに、導線面の整理ポイントを提案してください。

- total_links
- anchor_links
- internal_links
- external_links
- tel_links
- mail_links
- pdf_links
- empty_href_links
- placeholder_links
- suspicious_links

### 3. 良好だった点

以下のような値が良好な場合は、評価できる点として書いてください。

- title_matched_keywords が true
- empty_href_links が 0
- placeholder_links が 0
- suspicious_links が 0
- page_opened が true

改善点だけでなく、良い点も必ず含めてください。

---

## 出力形式

以下の構成でMarkdownを出力してください。

# Webサイト簡易確認レポート

## 1. 概要

対象サイト名、URL、確認範囲を簡潔に説明してください。

## 2. 確認できたこと

JSONから確認できる事実を、読みやすい文章でまとめてください。

## 3. 優先して確認するとよさそうな点

特に h1_text が空の場合は、ここで扱ってください。

## 4. リンク・導線面の確認

リンク数、アンカーリンク、外部リンク、PDFリンクなどをもとに、やわらかく提案してください。

## 5. 良好だった点

確認結果から評価できる点を書いてください。

## 6. 追加で確認するとよさそうな点

このJSONだけでは断定できないが、今後確認するとよさそうな項目を書いてください。

## 7. 補足

このレポートが、公開範囲に基づく簡易確認であることを明記してください。

---

## 最後の注意

出力は、そのまま提出用Markdownのたたき台として使える文章にしてください。

特定の実装方法を一択として勧めず、「状況に応じて確認・整理するとよさそうです」という表現にしてください。

ただし、見ていないことを断定せず、観測結果に基づいて書いてください。
`;
}

/**
 * 指定サイトの検査結果JSONを読み込み、ai-harness.md を生成する。
 *
 * @param site_id レポート対象サイトID
 */
async function generate_ai_harness(site_id: string): Promise<void> {
  const smoke_summary_path = getSummaryJsonPath(site_id, SUMMARY_FILES.smoke);

  const navigation_summary_path = getSummaryJsonPath(
    site_id,
    SUMMARY_FILES.navigation,
  );

  const ai_harness_path = get_ai_harness_path(site_id);

  const smoke_summary = await read_json<LegacySmokeSummary>(smoke_summary_path);
  const navigation_summary = await read_json<LegacyNavigationSummary>(
    navigation_summary_path,
  );

  const ai_harness = build_ai_harness(smoke_summary, navigation_summary);

  await fs.writeFile(ai_harness_path, ai_harness, "utf-8");

  console.log(`Generated: ${ai_harness_path}`);
}

/**
 * reports/配下から、必要な検査結果JSONを持っているサイトIDだけを取得する。
 *
 * @returns ai-harness.md を生成できるサイトID一覧
 */
async function find_report_site_ids(): Promise<string[]> {
  const reports_dir = path.dirname(getReportDataDir("__dummy__"));
  const entries = await fs.readdir(reports_dir, { withFileTypes: true });
  const site_ids: string[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const site_id = entry.name;

    const smoke_summary_path = getSummaryJsonPath(site_id, SUMMARY_FILES.smoke);

    const navigation_summary_path = getSummaryJsonPath(
      site_id,
      SUMMARY_FILES.navigation,
    );

    try {
      await fs.access(smoke_summary_path);
      await fs.access(navigation_summary_path);

      site_ids.push(site_id);
    } catch {
      // 必要なJSONが揃っていないフォルダは対象外にする
    }
  }

  return site_ids;
}

/**
 * エントリーポイント。
 *
 * site_id が指定された場合はそのサイトだけ生成する。
 * 指定がなければ reports/ 配下から自動検出して一括生成する。
 */
async function main(): Promise<void> {
  // コマンドの「3番目の単語」を site_id として受け取る
  const site_id = process.argv[2];

  if (site_id) {
    await generate_ai_harness(site_id);
    return;
  }

  const site_ids = await find_report_site_ids();

  if (site_ids.length === 0) {
    console.log("No report data found.");
    return;
  }

  for (const current_site_id of site_ids) {
    await generate_ai_harness(current_site_id);
  }
}

// エラーハンドリング付き実行
main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
