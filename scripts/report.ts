/**
 * Webサイト簡易確認レポートのMarkdownを生成する
 * npm run report:md
 *
 * 目的：
 * - PDF化の前段階として report-source.md を作る
 * - まずは固定文ベースで最後までの流れを確認する
 * - 後から smoke / navigation / screenshot の結果を差し込める形にする
 */

import fs from "fs";
import path from "path";
import { getActiveTargetSites } from "../helpers/target";

interface SmokeSummary {
  site_id: string;
  site_name: string;
  base_url: string;
  page_opened: boolean;
  title_checked: boolean;
  title_text: string;
  title_matched_keywords: boolean;
  h1_exists: boolean;
  h1_text: string;
  h1_has_text?: boolean;
}

interface NavigationSummary {
  site_id: string;
  site_name: string;
  base_url: string;
  total_links: number;
  anchor_links: number;
  empty_href_links: number;
  placeholder_links: number;
  tel_links: number;
  mail_links: number;
  pdf_links: number;
  internal_links: number;
  external_links: number;
  suspicious_links: number;
}

const REPORTS_DIR = "reports";

const activeSites = getActiveTargetSites();

/**
 * smoke-summary.json を読み込む
 *
 * ファイルが存在しない場合は null を返す。
 */
const readSmokeSummary = (siteId: string): SmokeSummary | null => {
  const summaryPath = path.join(
    REPORTS_DIR,
    siteId,
    "data",
    "smoke-summary.json",
  );

  if (!fs.existsSync(summaryPath)) {
    console.log(`スモーク集計JSONが見つかりません: ${summaryPath}`);
    return null;
  }

  const jsonText = fs.readFileSync(summaryPath, "utf-8");

  return JSON.parse(jsonText) as SmokeSummary;
};

/**
 * navigation-summary.json を読み込む
 *
 * ファイルが存在しない場合は null を返す。
 */
const readNavigationSummary = (siteId: string): NavigationSummary | null => {
  const summaryPath = path.join(
    REPORTS_DIR,
    siteId,
    "data",
    "navigation-summary.json",
  );

  if (!fs.existsSync(summaryPath)) {
    console.log(`ナビゲーション集計JSONが見つかりません: ${summaryPath}`);
    return null;
  }

  const jsonText = fs.readFileSync(summaryPath, "utf-8");

  return JSON.parse(jsonText) as NavigationSummary;
};

/**
 * 現在日時を YYYY-MM-DD HH:mm 形式で返す
 */
const getNowText = (): string => {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const date = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");

  return `${year}-${month}-${date} ${hours}:${minutes}`;
};

/**
 * レポート用Markdownを生成する
 */
const buildReportMarkdown = (
  siteName: string,
  siteUrl: string,
  smokeSummary: SmokeSummary | null,
  navigationSummary: NavigationSummary | null,
): string => {
  const checkedAt = getNowText();

  const h1HasText =
    smokeSummary?.h1_has_text ?? Boolean(smokeSummary?.h1_text.trim());

  const smokeSummaryText = smokeSummary
    ? `対象URLへアクセスし、トップページが表示できることを確認しました。  
取得したページタイトルは「${smokeSummary.title_text}」です。  
titleに想定キーワードが含まれているか：${smokeSummary.title_matched_keywords ? "確認済み" : "要確認"}  
h1要素の存在：${smokeSummary.h1_exists ? "確認済み" : "要確認"}  
h1テキスト：${h1HasText ? `「${smokeSummary.h1_text}」` : "空文字として取得されました。テーマ構造や見出し設定を確認するとよさそうです。"}`
    : `スモークテスト集計データはまだ生成されていません。`;

  const navigationSummaryText = navigationSummary
    ? `トップページ内で ${navigationSummary.total_links} 件のリンクを確認しました。  
ページ内アンカーは ${navigationSummary.anchor_links} 件、内部リンクは ${navigationSummary.internal_links} 件、外部リンクは ${navigationSummary.external_links} 件確認されました。  
電話リンクは ${navigationSummary.tel_links} 件、メールリンクは ${navigationSummary.mail_links} 件、PDFリンクは ${navigationSummary.pdf_links} 件確認されました。  
hrefなしリンクは ${navigationSummary.empty_href_links} 件、#のみのリンクは ${navigationSummary.placeholder_links} 件、要確認候補リンクは ${navigationSummary.suspicious_links} 件でした。`
    : `ナビゲーション集計データはまだ生成されていません。`;

  return `# 公開範囲に基づくWebサイト簡易確認レポート

## 1. 対象サイト

| 項目 | 内容 |
|---|---|
| サイト名 | ${siteName} |
| 対象URL | ${siteUrl} |
| 確認日時 | ${checkedAt} |

---

## 2. 確認範囲

本レポートは、公開されているWebページを対象にした簡易確認です。  
Webサイトの基本表示、リンク導線、PC・スマートフォン表示の確認を行い、改善提案の材料を整理することを目的としています。

以下の確認は行っていません。

- 問い合わせフォームの自動送信
- ログイン領域へのアクセス
- 短時間での大量アクセス
- 負荷テスト
- 脆弱性診断に該当する確認

---

## 3. 確認項目

| 確認項目 | 内容 | 結果 |
|---|---|---|
| トップページ表示 | 対象URLへアクセスできるか | 確認済み |
| title確認 | ページタイトルが取得できるか | 確認済み |
| h1確認 | トップページにh1が存在するか | 確認済み |
| リンク確認 | トップページ内のリンク情報を取得できるか | 確認済み |
| PC表示 | PC幅でスクリーンショットを保存できるか | 確認済み |
| スマートフォン表示 | スマートフォン幅でスクリーンショットを保存できるか | 確認済み |

---

## 4. 代表スクリーンショット

PDF本文には、確認用の代表画像としてトップページのPC表示・スマートフォン表示のみを掲載しています。

### PC表示

![PC表示](./images/pc-home.png)

### スマートフォン表示

![スマートフォン表示](./images/sp-home.png)

---

## 5. 観測された事実

今回の簡易確認では、以下の観点でWebサイトの状態を確認しました。

- トップページがブラウザ上で表示できること
- HTMLのtitleを取得できること
- h1要素が存在すること
- トップページ内のリンク情報を取得できること
- PC幅・スマートフォン幅で表示状態を画像として保存できること

### 基本表示確認

${smokeSummaryText}

### リンク・導線確認

${navigationSummaryText}

この確認により、公開ページの基本的な表示状態と、主要な導線確認の土台を把握できます。

---

## 6. 改善候補

今回のMVPでは、まず公開ページの基本確認とスクリーンショット保存を行っています。  
今後、以下の項目を追加することで、より具体的な改善提案につなげられます。

| 改善候補 | 期待できる効果 |
|---|---|
| 主要ページごとのリンク確認 | リンク切れや不要な導線を見つけやすくなる |
| スマートフォン表示の重点確認 | 利用者がスマホで閲覧した際の見やすさを確認できる |
| meta description確認 | 検索結果やSNS共有時の見え方改善につながる |
| 画像alt確認 | アクセシビリティや情報補足の改善につながる |
| 問い合わせ導線の確認 | 利用者が迷わず問い合わせできるか確認できる |

---

## 7. 推奨アクション

今後は、トップページだけでなく主要ページも同じ条件で定期的に確認することで、表示崩れやリンク切れを早期に発見しやすくなります。

特に、以下のような確認を継続すると、Webサイトの保守品質向上につながります。

- 公開前・更新後にPC表示とスマートフォン表示を確認する
- 主要リンクが期待通りに機能しているか確認する
- 問い合わせ導線が利用者にとって分かりやすいか確認する
- 確認結果をレポートとして残し、改善履歴を追えるようにする

入社後は、このような確認作業を仕組み化し、Webサイトの品質維持や改善提案に貢献できると考えています。

---

## 8. 補足

本レポートの作成に使用した簡易チェックツールは、GitHub上で公開しております。  
実装内容にご興味がございましたら、あわせてご覧ください。

https://github.com/Leon20200809/lg-website-inspector
`;
};

/**
 * reports/{site_id}/report-source.md を作成する
 */
activeSites.forEach((targetSite) => {
  const siteReportDir = path.join(REPORTS_DIR, targetSite.id);
  const reportPath = path.join(siteReportDir, "report-source.md");

  fs.mkdirSync(siteReportDir, {
    recursive: true,
  });

  const smokeSummary = readSmokeSummary(targetSite.id);
  const navigationSummary = readNavigationSummary(targetSite.id);

  const markdown = buildReportMarkdown(
    targetSite.name,
    targetSite.base_url,
    smokeSummary,
    navigationSummary,
  );
  
  fs.writeFileSync(reportPath, markdown, "utf-8");

  console.log(`レポートを生成しました: ${reportPath}`);
});
