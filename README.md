# LazyGenius Website Inspector

PlaywrightとTypeScriptを使い、Webサイトの公開状態を自動で観測し、改善提案や保守確認に使える事実をJSON・画像・Markdown・PDFとして残す検査ツールです。

正式名称は **LazyGenius Website Inspector** です。

---

## 概要

このツールは、公開前の自作サイトや、メンテナンス状況を確認したいWebサイトに対して、ブラウザ上で確認できる基本情報を自動収集します。

主な目的は、単にテストを成功・失敗へ分けることではありません。

```text
WebサイトをPlaywrightで観測する
↓
結果を型付きデータへ整理する
↓
JSONとして証拠を保存する
↓
AIが扱いやすいMarkdownへ変換する
↓
人間が確認できるレポートへ整える
```

感覚ではなく、公開情報から確認できた事実をもとに、改善提案・保守確認・公開前チェックを行える状態を目指しています。

---

## このプロジェクトでできること

現在は、以下の確認に対応しています。

### 基本表示

- 対象ページが開けるか
- HTTPレスポンスが正常か
- リダイレクト後の最終URL
- ページタイトル
- 想定キーワードを含むか
- h1の存在と文字列

### メタ情報

- title
- meta description
- canonical URL
- html要素のlang属性

### 見出し構造

- h1〜h3の出現順
- 見出し総数
- レベル別件数
- 空見出し数

### リンク

- ページ内リンクの一覧
- 内部リンク・外部リンク
- ページ内アンカー
- 電話・メール・PDFリンク
- hrefなし・仮リンク
- 空テキストリンク
- アンカー移動先の存在
- HTTPステータス
- リダイレクト
- アクセス制限候補
- リンク切れ候補
- 同一URLの重複検査防止

### 画像

- ページ内の全img要素
- src属性
- ブラウザが実際に採用したcurrentSrc
- alt属性の有無・空文字
- loading属性
- complete状態
- 実画像の幅・高さ
- 正常読込・画像切れ・未読込・判定不能の分類
- lazy画像を発火させるページ巡回

### フォーム

- form要素の有無と件数
- action属性と解決後URL
- method・enctype
- input・textarea・select・button
- name・id・placeholder・autocomplete
- 必須項目
- disabled・readonly
- label・aria-label・aria-labelledby
- ラベル欠落候補
- 送信ボタン
- プライバシー・規約同意候補

フォーム構造は確認しますが、外部サイトへの入力・クリック・送信は行いません。

### スクリーンショット

- PC幅のフルページ画像
- スマホ幅のフルページ画像

---

## 現在の処理パイプライン

```text
PlaywrightでWebサイトを観測
↓
検査別Summary JSONを保存
↓
AI投入用 ai-harness.md を生成
↓
人間向け report-source.md を生成
↓
report-source.html へ変換
↓
report.pdf を生成
```

### 各成果物の役割

```text
Playwright
→ 公開ページの観測係

types
→ 報告書の書式

Summary JSON
→ 観測結果と根拠データ

ai-harness.md
→ AIへの作戦命令書

AI
→ 観測結果の文章化・改善候補生成

人間
→ 最終判断・修正・提出判断

PDF
→ 外向きの成果物
```

---

## 設計方針

### 1. 事実収集と評価を分ける

例：

```text
事実
→ alt属性が存在しない画像が4件ある

評価
→ その画像に説明が必要かは、画像の役割を確認して判断する
```

Playwrightで取得できる事実と、改善すべきかという判断を混ぜません。

### 2. typesをGOALとして設計する

最終的に必要なJSONの形をTypeScriptの型で定義し、そこから必要な取得処理を逆算します。

```text
完成させたい型
↓
必要な項目
↓
DOM・HTTP・ブラウザ状態から取得
↓
Item配列
↓
Summaryへ集計
```

### 3. specは作戦指令書にする

`tests/*.spec.ts`には、検査の処理順序を残します。

```text
ページを開く
↓
検査条件を整える
↓
情報を収集する
↓
Summaryへ反映する
↓
JSONへ保存する
↓
Playwright Testとして合否判定する
```

### 4. inspectorは実働部隊にする

DOM調査・待機・分類・集計などの実装詳細は、`inspectors/*.ts`へ分離します。

### 5. 1関数は日本語1文の仕事を担当する

```text
ページを巡回する
表示画像の読込結果を待つ
画像情報を収集する
画像結果を集計する
```

「〜して、〜して、〜する」と説明が長くなる場合は、責務分割を検討します。

### 6. JSONを回帰確認の基準にする

リファクタリング前後で、主要な集計値と根拠データが変化していないか確認します。

構造を改善する段階では、意図せず検査結果を変えないことを勝利条件にします。

---

## 画像検査の現在の構造

`tests/image.spec.ts`は処理順序を担当し、画像固有の処理は`inspectors/image-inspector.ts`へ分離しています。

```text
page.goto()
↓
page.waitForLoadState("load")
↓
scrollThroughPage()
↓
waitForVisibleImageLoadResults()
↓
collectImageItems()
↓
applyImageSummary()
↓
saveJsonFile()
```

### `scrollThroughPage()`

```ts
scrollThroughPage(
  page: Page,
): Promise<void>
```

ページを上部から下部まで段階的に移動し、画面内への進入を条件とするlazy画像の読込を促します。

### `waitForVisibleImageLoadResults()`

```ts
waitForVisibleImageLoadResults(
  page: Page,
): Promise<void>
```

表示されている各画像について、読込成功・失敗・タイムアウトのいずれかが確定するまで待ちます。

### `collectImageItems()`

```ts
collectImageItems(
  page: Page,
): Promise<ImageItem[]>
```

ページ内の全img要素をブラウザ側で調査し、画像1枚ごとの根拠データを`ImageItem[]`として返します。

### `applyImageSummary()`

```ts
applyImageSummary(
  summary: ImageSummary,
  images: ImageItem[],
): void
```

画像総数、alt属性欠落数、空alt数、画像切れ候補数を集計し、`ImageSummary`へ反映します。

---

## フォーム検査の現在の構造

フォーム検査も、収集と集計を`inspectors/form-inspector.ts`へ分離しています。

```text
page.goto()
↓
page.waitForLoadState("load")
↓
collectFormItems()
↓
applyFormSummary()
↓
saveJsonFile()
```

### `collectFormItems()`

ページ内のフォームと入力項目を調査し、`FormItem[]`として返します。

### `applyFormSummary()`

フォーム数、入力項目数、必須項目数、ラベル欠落数を集計し、`FormSummary`へ反映します。

外部サイトへ値を入力したり、送信ボタンを押したりする処理は含みません。

---

## 主なファイル構成

```text
lg-website-inspector/
├── package.json
├── package-lock.json
├── playwright.config.ts
├── tsconfig.json
├── README.md
├── .gitignore
├── .env.example
│
├── tests/
│   ├── smoke.spec.ts
│   ├── navigation.spec.ts
│   ├── screenshot.spec.ts
│   ├── meta.spec.ts
│   ├── heading.spec.ts
│   ├── link.spec.ts
│   ├── image.spec.ts
│   └── form.spec.ts
│
├── inspectors/
│   ├── image-inspector.ts
│   └── form-inspector.ts
│
├── helpers/
│   ├── target.ts
│   ├── report-paths.ts
│   ├── json-file.ts
│   ├── date.ts
│   └── ...
│
├── types/
│   ├── common.ts
│   ├── target-site.ts
│   ├── meta-summary.ts
│   ├── heading-summary.ts
│   ├── link-summary.ts
│   ├── image-summary.ts
│   ├── form-summary.ts
│   └── ...
│
├── scripts/
│   ├── generate-ai-harness.ts
│   ├── report.ts
│   └── pdf.ts
│
└── reports/
    └── {site_id}/
        ├── data/
        │   ├── smoke-summary.json
        │   ├── navigation-summary.json
        │   ├── meta-summary.json
        │   ├── heading-summary.json
        │   ├── link-summary.json
        │   ├── image-summary.json
        │   └── form-summary.json
        │
        ├── images/
        │   ├── pc-home.png
        │   └── sp-home.png
        │
        ├── ai-harness.md
        ├── report-source.md
        ├── report-source.html
        └── report.pdf
```

---

## 各テストの役割

| テスト               | 主な確認内容                                 | 主な出力                      |
| -------------------- | -------------------------------------------- | ----------------------------- |
| `smoke.spec.ts`      | ページ表示・title・h1                        | `smoke-summary.json`          |
| `navigation.spec.ts` | リンク分類・HTTP確認・アンカー・リダイレクト | `navigation-summary.json`     |
| `screenshot.spec.ts` | PC・スマホのフルページ撮影                   | `pc-home.png` / `sp-home.png` |
| `meta.spec.ts`       | title・description・canonical・lang          | `meta-summary.json`           |
| `heading.spec.ts`    | h1〜h3の順序・件数・空見出し                 | `heading-summary.json`        |
| `link.spec.ts`       | 全リンクのDOM情報と詳細分類                  | `link-summary.json`           |
| `image.spec.ts`      | alt・lazy読込・実寸・画像状態                | `image-summary.json`          |
| `form.spec.ts`       | フォーム・入力項目・必須・ラベル             | `form-summary.json`           |

`navigation.spec.ts`は実際のHTTP応答確認を含む検査です。

`link.spec.ts`は、ページ内リンクの詳細な根拠データを型付きで残すための検査です。現在のHTTP確認用フィールドには、後続実装へ接続するための項目も含まれています。

---

## 使用技術

- Node.js
- npm
- TypeScript
- Playwright Test
- markdown-it
- tsx

---

## セットアップ

### 1. 依存関係をインストール

```bash
npm install
```

### 2. Playwright用ブラウザをインストール

普段の確認で使うChromiumを導入します。

```bash
npx playwright install chromium
```

Playwright本体の更新後にブラウザ実行ファイルの不一致が発生した場合も、再度このコマンドを実行します。

### 3. 型チェック

```bash
npm run typecheck
```

### 4. テスト実行

```bash
npm run test
```

---

## 主なコマンド

### Chromiumで通常実行

```bash
npm run test
```

### Chromiumを表示して実行

```bash
npm run test:headed
```

### Chromium・Firefox・WebKitで実行

```bash
npm run test:all
```

### 特定のテストだけ実行

```bash
npx playwright test tests/image.spec.ts
```

または、

```bash
npm run test -- tests/image.spec.ts
```

### TypeScript型チェック

```bash
npm run typecheck
```

### 型チェックを監視実行

```bash
npm run typecheck:watch
```

### Playwright HTMLレポートを開く

```bash
npm run report:html
```

### AI投入用ハーネスを生成

```bash
npm run harness:ai
```

### Markdownレポートを生成

```bash
npm run report:md
```

### PDFレポートを生成

```bash
npm run report:pdf
```

### UI Mode

```bash
npx playwright test --ui
```

### Debug Mode

```bash
npx playwright test tests/image.spec.ts --debug
```

---

## Playwright設定

`playwright.config.ts`では、主に以下を管理します。

- `tests/`をテスト対象にする
- テストの並列実行
- CIでの`test.only`禁止
- CIでの再試行
- CIでのWorker数制限
- HTML Reporter
- 再試行時のTrace保存
- Chromium・Firefox・WebKitのProject

普段はChromiumのみで高速に確認し、必要な時だけ全ブラウザへ展開します。

---

## 検査対象サイトの設定

検査対象は`helpers/target.ts`で管理します。

```ts
{
  id: "sample-site",
  name: "Sample Site",
  base_url: "https://example.com/",
  mode: "external",
  is_active: true,
  expected_title_keywords: [
    "Sample",
    "Company",
  ],
  allow_form_submit: false,
}
```

### 各項目

| 項目                      | 意味                           |
| ------------------------- | ------------------------------ |
| `id`                      | レポートフォルダ名に使う識別子 |
| `name`                    | テスト名・レポートで使う表示名 |
| `base_url`                | 検査対象URL                    |
| `mode`                    | `own` / `external` / `demo`    |
| `is_active`               | `true`のサイトだけ検査         |
| `expected_title_keywords` | title確認用キーワード          |
| `allow_form_submit`       | フォーム送信を許可するか       |

外部サイトでは、原則として次の設定にします。

```ts
mode: "external",
allow_form_submit: false,
```

---

## JSONの共通方針

検査別Summaryでは、可能な範囲で次の共通情報を持たせます。

```text
site_id
site_name
base_url
page_url
inspected_at
inspection_status
errors
```

### `base_url`と`page_url`

```text
base_url
→ 検査指令として指定したURL

page_url
→ リダイレクト後に実際に到達したURL
```

### `inspection_status`

```text
success
→ 検査処理を完了した

partial
→ 一部の観測はできたが、HTTP応答等に確認事項がある

failed
→ 検査処理自体を完了できなかった
```

`success`は「Webサイトに改善点がない」という意味ではありません。

---

## エラー時の保存方針

検査は基本的に次の構造で実行します。

```text
try
→ 検査を実行

catch
→ inspection_statusとerrorsへ失敗を記録

finally
→ 成功・失敗に関係なくJSONを保存

expect
→ 証拠保存後にPlaywright Testとして合否判定
```

テストが失敗した場合も、途中まで取得できた状態とエラー内容を残すことを重視します。

---

## 外部サイト検査時の方針

このツールは、脆弱性診断・負荷試験・侵入テストを目的としたものではありません。

### 行うこと

- 公開ページを開く
- title・meta・見出し・リンク・画像・フォーム構造を確認する
- スクリーンショットを保存する
- 低頻度でHTTPレスポンスを確認する
- 公開範囲から取得できる事実をJSONへ残す

### 行わないこと

- 外部サイトの問い合わせフォーム送信
- ログイン領域へのアクセス
- 短時間の大量アクセス
- 負荷試験
- 脆弱性探索
- 認証やアクセス制限の回避
- 相手の業務を発生させる操作

### 低負荷のための設計

- 対象ページを限定する
- 同じURLへの重複アクセスを避ける
- 不要な再試行を行わない
- ページ全体のスクロールを何度も繰り返さない
- 電話・メール・JavaScriptリンクはHTTP確認しない
- アクセス制限応答を、即座にリンク切れと断定しない

---

## レポート表現の方針

観測結果から、必要以上に強い断定を行いません。

### 避ける表現

```text
壊れています
問題があります
必ず修正すべきです
SEOで大きな損失が出ています
```

### 使用する表現

```text
確認するとよさそうです
改善余地がありそうです
整理すると伝わりやすくなります
読込成功を確認できませんでした
現時点では大きな不備は確認されませんでした
```

---

## 現在の開発状況

### 実装済み

- [x] Playwright Test初期構成
- [x] 複数対象サイト設定
- [x] Chromium通常実行
- [x] Chromium・Firefox・WebKitのProject
- [x] TypeScript型チェック
- [x] 共通のJSON保存処理
- [x] 共通のレポートパス生成
- [x] 基本表示確認
- [x] メタ情報収集
- [x] 見出し構造収集
- [x] リンク分類
- [x] リンク先HTTP確認
- [x] アンカー移動先確認
- [x] 画像情報収集
- [x] lazy画像の読込条件整備
- [x] 画像検査の責務分離
- [x] フォーム構造収集
- [x] フォーム検査の責務分離
- [x] PC・スマホスクリーンショット
- [x] AI投入用ハーネス生成
- [x] Markdownレポート生成
- [x] HTML変換
- [x] PDF生成

### 次の候補

- [ ] meta検査の責務分離
- [ ] heading検査の責務分離
- [ ] link検査の責務分離
- [ ] navigationとlinkの責務整理
- [ ] console-summary.json
- [ ] JavaScript Consoleエラー収集
- [ ] 複数ページ巡回
- [ ] 下層ページの検査範囲設定
- [ ] JSON Schemaまたは実行時バリデーション
- [ ] 検査前後のJSON差分比較
- [ ] AI提案ルールの精度向上
- [ ] レポート文面・レイアウト改善

---

## 開発時の標準手順

```text
1. 現状コードを確認する
2. JSONの基準値を確認する
3. 日本語1文で関数の仕事を決める
4. 入力と戻り値をtypesから確認する
5. 既存処理を挙動を変えずに移す
6. npm run typecheck
7. 対象テストだけ実行する
8. JSONを基準値と比較する
9. 次の1関数へ進む
```

---

## このプロジェクトの考え方

このプロジェクトは、単なるPlaywright練習ではありません。

Webサイトを人間が毎回確認していた作業を、自動で再現し、判断に使える形へ変えるための実務型プロジェクトです。

```text
人間が目視・コピペしていた情報
↓
Playwrightが自動収集
↓
TypeScriptで形を固定
↓
JSONで証拠化
↓
AIが整理・文章化
↓
人間が最終判断
```

まずは小さく動かし、事実を残し、後からプロ仕様へ育てる。

これがLazyGenius Website Inspectorの基本方針です。
