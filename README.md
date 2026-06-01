# LazyGenius Website Inspector

Playwright を使って、Webサイトの基本的な表示確認・リンク確認・レスポンシブ表示確認・スクリーンショット取得を行うための検査ツールです。

正式名称は **LazyGenius Website Inspector** です。

目的は、公開前の自作サイトや、メンテナンス不足が疑われるWebサイトに対して、最低限の動作確認を自動化し、改善提案や保守確認の材料を集めることです。

---

## このツールでできること

現在は、以下の簡易確認に対応しています。

* トップページが開けるか確認
* ページタイトルの取得
* title に想定キーワードが含まれるか確認
* h1 要素の存在確認
* h1 テキストの取得
* トップページ内リンクの集計
* PC / スマホ幅のスクリーンショット保存
* 検査結果の JSON 保存
* Markdown レポート生成
* AI投入用ハーネスMarkdown生成
* PDF レポート生成

---

## 現在のパイプライン

現在は、以下の流れまで開通しています。

```text
Playwrightで確認
↓
検査結果をJSON保存
↓
AI投入用 ai-harness.md を生成
↓
report-source.md を生成
↓
report-source.html を生成
↓
report.pdf を生成
```

このツールでは、検査結果JSONをそのまま最終文書にせず、AIに渡すための `ai-harness.md` を生成します。

`ai-harness.md` には、観測結果・表現ルール・禁止事項・出力形式をまとめています。
これにより、AIが出力する改善提案文を制御し、人間が最終確認しやすいレポート作成フローを目指しています。

---

## 使用技術

* Node.js
* npm
* TypeScript
* Playwright
* markdown-it
* tsx

---

## 主なコマンド

通常テスト実行。

```bash
npm run test
```

ブラウザを表示してテスト実行。

```bash
npm run test:headed
```

全ブラウザでテスト実行。

```bash
npm run test:all
```

HTMLレポートを表示。

```bash
npm run report:html
```

特定ファイルだけ実行。

```bash
npm run test -- tests/smoke.spec.ts
```

AI投入用ハーネスMarkdownを生成。

```bash
npm run harness:ai
```

Markdownレポートを生成。

```bash
npm run report:md
```

PDFレポートを生成。

```bash
npm run report:pdf
```

---

## package.json scripts

推奨設定例。

```json
"scripts": {
  "test": "playwright test --project=chromium",
  "test:headed": "playwright test --project=chromium --headed",
  "test:all": "playwright test",
  "report:html": "playwright show-report",
  "harness:ai": "tsx scripts/generate-ai-harness.ts",
  "report:md": "tsx scripts/report.ts",
  "report:pdf": "tsx scripts/pdf.ts"
}
```

普段は Chromium のみで軽く確認します。
必要な時だけ `test:all` で Chromium / Firefox / WebKit をまとめて確認します。

---

## フォルダ構成

```text
lg-website-inspector/
├── package.json
├── package-lock.json
├── playwright.config.ts
├── README.md
├── .gitignore
├── .env.example
├── tests/
│   ├── smoke.spec.ts
│   ├── navigation.spec.ts
│   └── screenshot.spec.ts
├── helpers/
│   ├── target.ts
│   └── screenshot.ts
├── scripts/
│   ├── generate-ai-harness.ts
│   ├── report.ts
│   └── pdf.ts
└── reports/
    └── {site_id}/
        ├── data/
        │   ├── smoke-summary.json
        │   └── navigation-summary.json
        ├── images/
        │   ├── pc-home.png
        │   └── sp-home.png
        ├── ai-harness.md
        ├── report-source.md
        ├── report-source.html
        └── report.pdf
```

`screenshots/` は使わず、スクリーンショットは最初から `reports/{site_id}/images/` に保存します。

---

## 各ファイルの役割

### tests/smoke.spec.ts

最低限、サイトが生きているかを確認するテストです。

確認内容。

* 対象URLを開けるか
* title を取得できるか
* title が期待キーワードを含むか
* h1 が存在するか
* h1 テキストを取得できるか

結果は以下に保存します。

```text
reports/{site_id}/data/smoke-summary.json
```

---

### tests/navigation.spec.ts

トップページ内のリンク・導線情報を収集するテストです。

確認内容。

* リンク総数
* ページ内アンカー数
* hrefなしリンク数
* #のみリンク数
* 電話リンク数
* メールリンク数
* PDFリンク数
* 内部リンク数
* 外部リンク数
* 要確認候補リンク数

結果は以下に保存します。

```text
reports/{site_id}/data/navigation-summary.json
```

---

### tests/screenshot.spec.ts

PC幅・スマホ幅の代表スクリーンショットを保存するテストです。

保存先。

```text
reports/{site_id}/images/
```

生成される画像。

```text
pc-home.png
sp-home.png
```

---

### helpers/target.ts

検査対象サイトの設定を置く場所です。

主な項目。

```text
id
name
base_url
mode
is_active
expected_title_keywords
allow_form_submit
```

`is_active: true` のサイトだけ検査対象にします。

外部サイトを確認する場合は、原則として以下の設定にします。

```text
mode: external
allow_form_submit: false
```

---

### scripts/generate-ai-harness.ts

検査結果JSONを読み込み、主要AIに投げやすい `ai-harness.md` を生成するスクリプトです。

`ai-harness.md` には、以下をまとめます。

* 検査結果JSON
* AIへの役割指定
* 表現ルール
* 避ける表現
* 断定してよいこと
* 断定してはいけないこと
* 出力形式

AIに丸投げするのではなく、AIが外しにくい作業場を整えるための中間ファイルです。

---

### scripts/report.ts

検査結果JSONを読み込み、人間向けの `report-source.md` を生成するスクリプトです。

生成先。

```text
reports/{site_id}/report-source.md
```

---

### scripts/pdf.ts

MarkdownをHTMLに変換し、さらにPDF化するスクリプトです。

流れ。

```text
report-source.md
↓
report-source.html
↓
report.pdf
```

---

## 外部サイト確認時の方針

このツールは、脆弱性診断ではありません。

やってよいこと。

* ページを開く
* title / h1 を確認する
* リンク情報を確認する
* スクリーンショットを撮る
* スマホ幅で表示確認する

避けること。

* 問い合わせフォームの自動送信
* 短時間の大量アクセス
* ログイン領域へのアクセス
* 負荷テスト
* 脆弱性診断に見える確認

レポート内でも、公開範囲に基づく簡易確認であることを明記します。

---

## レポートの温度感

断定しすぎず、相手に配慮した表現にします。

避ける表現。

```text
問題があります
壊れています
修正すべきです
SEO的に大きな損失です
```

使う表現。

```text
確認するとよさそうです
改善余地がありそうです
整理すると伝わりやすくなります
現時点では大きな不備は確認されませんでした
```

---

## .gitignore 方針

GitHubに上げないもの。

```gitignore
node_modules/
/test-results/
/playwright-report/
/blob-report/
/playwright/.cache/
/playwright/.auth/
.env
```

`node_modules` や Playwright の実行結果レポートは成果物なので、Git管理しません。

必要に応じて、生成済みのPDFや画像をGit管理するかどうかは運用方針に合わせて判断します。

---

## 今後やること

次に育てる候補。

1. 改善候補セクションをJSON値に応じて賢くする
2. h1_text が空の場合、改善候補に反映する
3. hrefなし / #のみ / suspicious_links がある場合、改善候補に反映する
4. PDFの文面をより自然な社会語に整える
5. 画像の扱いを検討する
6. meta description や画像altの確認を追加する
7. 主要下層ページの確認を追加する

---

## このプロジェクトの考え方

このプロジェクトは、単なるPlaywright練習ではありません。

Webサイトの基本確認を自動化し、観測結果をJSONとして残し、AIに渡しやすいMarkdownに整え、人間が最終確認してPDF化するための小型ツールです。

```text
Playwright = 観測係
JSON = 観測結果
ai-harness.md = AIへの作戦命令書
AI = 文章化・提案生成
人間 = 最終判断・修正・提出判断
PDF = 外向きの成果物
```

まずは小さく確認し、結果を残し、改善提案の材料にする。
これが LazyGenius Website Inspector の第一目的です。
