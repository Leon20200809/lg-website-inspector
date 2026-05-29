# LazyGenius Website Inspector

Playwright を使って、Webサイトの基本的な表示確認・リンク確認・レスポンシブ表示確認・スクリーンショット取得を行うための検査ツールです。

目的は、公開前の自作サイトや、メンテナンス不足が疑われるWebサイトに対して、最低限の動作確認を自動化し、改善提案や保守確認の材料を集めることです。

---

## 現在の状態

第一形態として、Playwright の初期セットアップまで完了。

確認済みのこと。

* npm プロジェクト初期化
* Playwright 導入
* Chromium / Firefox / WebKit のサンプルテスト実行
* HTMLレポート表示確認
* `smoke.spec.ts` のMVP作成
* `navigation.spec.ts` のMVP作成
* `helpers/target.ts` に対象サイト設定を分離

最初の検査対象サイト。

```text
https://lazygenius.dev/
```

---

## 使用技術

* Node.js
* npm
* TypeScript
* Playwright

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

ブラウザ表示ありで特定ファイルだけ実行。

```bash
npm run test:headed -- tests/smoke.spec.ts
```

---

## package.json scripts

現時点の推奨設定。

```json
"scripts": {
  "test": "playwright test --project=chromium",
  "test:headed": "playwright test --project=chromium --headed",
  "test:all": "playwright test",
  "report:html": "playwright show-report"
}
```

普段は Chromium のみで軽く確認する。
必要な時だけ `test:all` で Chromium / Firefox / WebKit をまとめて確認する。

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
│   ├── screenshot.spec.ts
│   └── navigation.spec.ts
├── helpers/
│   ├── target.ts
│   └── screenshot.ts
├── reports/
│   └── .gitkeep
└── screenshots/
    └── .gitkeep
```

---

## 各ファイルの役割

### tests/smoke.spec.ts

最低限、サイトが生きているかを確認するテスト。

確認内容。

* 対象URLを開けるか
* title が期待する内容か
* h1 が存在するか

スモークテストは、細かい検査ではなく「最低限燃えていないか」を見る確認。

---

### tests/navigation.spec.ts

ページ内リンクや内部リンクの導線を確認するテスト。

現在のMVPでは、トップページ内のリンクを取得し、内部リンクを検査する。

今回の学び。

* `page.goto()` は通常のページ遷移リンクには向いている
* `#about` などのページ内アンカーでは HTTP response が返らないことがある
* ページ内アンカーは `response.ok()` ではなく、対象IDの存在確認で見る方が自然

---

### tests/screenshot.spec.ts

今後、PC幅・スマホ幅のスクリーンショット保存を担当する予定。

次に育てる候補。

* PC幅スクリーンショット
* スマホ幅スクリーンショット
* 保存先を `screenshots/` に統一
* ファイル名にサイト名・画面幅・日時を入れる

---

### helpers/target.ts

検査対象サイトの設定を置く場所。

例。

```ts
export const target_site = {
  name: 'LazyGenius.dev',
  base_url: 'https://lazygenius.dev/',
  expected_title_keywords: [
    'LazyGenius',
    'Leon',
    'Web',
    'WordPress',
  ],
};
```

URLや期待するtitleキーワードをここにまとめることで、テスト本体を書き換えずに対象サイトを変更できる。

---

### helpers/screenshot.ts

今後、スクリーンショット保存処理を共通化する場所。

例。

* 保存ファイル名の生成
* 保存先パスの生成
* PC / SP の画面幅設定
* 日付付きファイル名の作成

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

`node_modules` や Playwright の実行結果レポートは成果物なので、Git管理しない。

---

## 現在わかったこと

Playwright は、人間がブラウザで行う確認作業を TypeScript のスクリプトとして実行できる道具。

今回つかんだこと。

* `tests/*.spec.ts` にテストを書く
* `npm run test` で実行する
* `npm run test:headed` でブラウザ表示ありで確認できる
* `npm run report:html` でHTMLレポートを見られる
* どのブラウザで、どのテストが、何秒かかって、どこで落ちたか確認できる
* 3ブラウザ実行時は `テスト数 × ブラウザ数` で件数が増える
* ページ内アンカーと通常ページリンクは扱いを分けた方がいい

---

## 次にやること

次に育てるなら、この順番。

1. `screenshot.spec.ts` を作る
2. PC幅スクリーンショットを保存する
3. スマホ幅スクリーンショットを保存する
4. `helpers/screenshot.ts` に保存処理を分離する
5. `navigation.spec.ts` でページ内アンカーのID存在確認を追加する
6. Markdownレポート出力を検討する

---

## 次回再開時のおすすめコマンド

まず状態確認。

```bash
npm run test -- tests/smoke.spec.ts
```

ブラウザ表示ありで確認。

```bash
npm run test:headed -- tests/smoke.spec.ts
```

ナビゲーション確認。

```bash
npm run test:headed -- tests/navigation.spec.ts
```

HTMLレポート確認。

```bash
npm run report:html
```

---

## メモ

今回の第一形態では、コードの完成度よりも「Playwright が何者かを体感すること」を優先した。

現時点の理解。

```text
smoke.spec.ts
→ 生存確認

navigation.spec.ts
→ 導線確認

screenshot.spec.ts
→ 証拠保存

helpers/target.ts
→ 対象サイト設定
```

次回は `screenshot.spec.ts` から育てると、Webサイト検査ツールらしさが一気に増す。
