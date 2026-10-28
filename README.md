# LazyGenius Website Inspector

PlaywrightとTypeScriptで公開Webページを観測し、証拠のJSON・画像と、初回点検レポートのMarkdown・HTML・PDFを保存するツールです。

現在の主な入口は、**URLを一つ指定して点検し、保存した証拠を人間が確認してレポートを整える**初回点検CLIです。サイトの目的や事業上の課題は、URLだけから確定しません。

## 最短で使う

Node.js 24とnpmで動作確認しています。リポジトリのディレクトリで実行してください。

```bash
npm ci
npx playwright install chromium
npm run typecheck
npm run inspect -- https://example.com/
```

必須入力はURLだけです。`helpers/target.ts`の編集や、会社名・事業目的・気になる点の入力は不要です。`inspect`はCLIをビルドしてから実行します。

実行結果に表示される`directory`が、その回の保存先です。生成された`report.pdf`と証拠画像を開き、内容を確認してください。日本語PDFの生成には、実行環境に日本語フォントが必要です。たとえばNoto Sans CJK JP、Noto Sans JP、游ゴシックなどを利用します。

### 既定の確認条件

| 項目 | 既定値・動作 |
| --- | --- |
| 対象 | 認証情報を含まない公開HTTP/HTTPS URL |
| ページ数 | 起点を含めて最大5ページ |
| ページの選び方 | 起点、指定した重要URL、起点で見つかったリンク。問い合わせ・会社・サービス等のページを優先 |
| 対象範囲 | 起点と同じorigin。別のoriginは明示設定が必要 |
| PC幅 | Chromium、1280 × 900px |
| スマホ幅 | Chromium、390 × 844px。実機やスマートフォン固有の動作の再現ではない |
| ページ移動の待機上限 | 15,000ms |
| 観測間の待ち時間 | 500ms |
| 保存先 | `reports/<site-id>/<run-id>/` |

同じoriginとは、URLのスキーム・ホスト・ポートが同じ範囲です。たとえば`https://example.com`と`https://www.example.com`は別扱いです。起点から見つかったページを対象にするため、サイト全体を再帰的に巡回するものではありません。

## 現在できること

| 分野 | 収集・保存する内容 |
| --- | --- |
| ページ到達 | 指定URL、最終URL、HTTPステータス、リダイレクト、到達処理の成否 |
| メタ情報 | title、description、canonical、htmlのlang属性 |
| 見出し | h1〜h3の文字列・順序・レベル |
| リンク構造 | 内部・外部・アンカー・電話・メール等の分類、空hrefや仮リンク、アンカー移動先の候補 |
| 画像 | img要素のsrc・currentSrc・alt・実寸・読み込み状態。スクロールでlazy画像の読み込みを促す |
| フォーム構造 | フォームと入力項目、必須属性、ラベルやARIAによる名前の候補、送信ボタン等 |
| 横幅 | viewportと文書全体の幅、横方向のはみ出し候補 |
| 画面の証拠 | ページとPC/SP条件ごとの表示範囲画像・全体画像、取得できた場合は最初の表示フォーム画像 |
| 実行記録 | 実行ID、開始・終了時刻、ツール・ブラウザのバージョン、取得できた場合はソースコミット、採用・除外したURLと理由 |
| 初回レポート | 観測結果に基づく良い点、確認候補、影響の仮説、質問、次の一手、点検範囲と未確認事項 |

確認候補の自動抽出は、横方向のはみ出し、読み込みを確認できなかった画像、入力欄のラベル、ページタイトル、言語指定のルールを使います。現在の文面生成はルールベースで、AI APIによる分析は組み込んでいません。

HTTPエラーページや取得できなかった項目を、通常ページの「情報がない」という指摘へ置き換えない設計です。同じページのPC/SPで得た候補をまとめ、証拠IDと画像へ結び付けます。

## 出力ファイル

実行ごとに時刻とランダムIDを含む別フォルダを作り、過去の観測結果を残します。

```text
reports/<site-id>/<run-id>/
├── manifest.json
├── report-content.json
├── report-source.md
├── report-source.html
├── report.pdf
└── chromium/
    ├── pc/<url-hash>/
    │   ├── observation.json
    │   ├── viewport.png
    │   ├── full.png
    │   └── form.png
    └── sp/<url-hash>/
        └── ...
```

画像は取得できたものだけ保存されます。失敗・未実施の状態や理由はJSONで確認します。

| ファイル | 役割 |
| --- | --- |
| `manifest.json` | 実行条件、範囲、全体と各ページの取得状態、エラー、証拠への参照 |
| `observation.json` | 一つのページ・表示条件についての観測結果 |
| `report-content.json` | 人が確認・編集する説明文、候補、優先順位、レビュー状態 |
| `report-source.md` | レポート本文。画像はrun内の相対パスを参照 |
| `report-source.html` | 画像を埋め込んだHTMLレポート |
| `report.pdf` | A4の確認用PDF |

レポートは「概要」「証拠と確認候補」「次の一手と点検範囲」の3部構成です。確認候補が0件の場合は証拠ページを省いた2部構成になります。本文量によってPDFのページ数は変わります。確認日時はJSTで表示します。

`reports/`はGit管理対象外です。観測JSON、画面画像、編集した説明文には対象サイト固有の情報が含まれるため、公開や受け渡しの前に内容を確認してください。

## 人が確認してレポートを再生成する

1. `report.pdf`、画像、必要な観測JSONを照合する。
2. `report-content.json`の説明文、候補、優先順位、確認メモを編集する。
3. 同じrunフォルダを指定して再生成する。
4. 新しいPDFの本文・画像・改ページを確認する。

```bash
npm run report:initial -- reports/<site-id>/<run-id>
```

`<site-id>/<run-id>`は、実行結果に表示された実際のフォルダ名へ置き換えてください。このコマンドはCLIをビルドし、**保存済みのJSONと画像から再生成します。対象サイトへ再アクセスしません。**

編集対象は`report-content.json`です。`report-source.md`やHTMLを直接変更しても、次の再生成で上書きされます。観測事実を変えるために`manifest.json`や`observation.json`を書き換えず、別の観測が必要な場合は新しいrunを作ります。

### レビュー状態

| 項目 | 値 | 意味 |
| --- | --- | --- |
| 候補の`review_status` | `unreviewed` | 自動抽出された未確認の候補 |
| 同上 | `confirmed` | 人が観測内容を確認した候補 |
| 同上 | `deferred` | 保留。今回の本文には掲載しない |
| 同上 | `dismissed` | 採用しない。今回の本文には掲載しない |
| 全体の`owner_review` | `pending` | レビュー用・提出前。自動生成時の状態 |
| 同上 | `completed` | 担当者のレビューを反映した状態 |

候補は確認済みを優先し、その後は優先度順で最大3件を本文へ掲載します。全候補はJSONに残ります。`confirmed`は事業への影響や修正の必要性まで証明するものではありません。全体を`completed`へ変えるだけで、顧客の同意や確認していない機能の動作を保証することにもなりません。

再生成前に、JSONの形式、実行ID、証拠IDとURLの対応、画像・証拠ファイルの参照先を検証します。保存したrunの外にあるファイルや、外部画像URLへの置換は受け付けません。説明が事実に即しているか、顧客に提出してよいかは、人が判断してください。

## 任意の設定

URL以外の情報は、分かっている場合だけ追加します。

```bash
npm run inspect -- https://example.com/ --max-pages 3
npm run inspect -- https://example.com/ --config inspection-config.json
npm run inspect -- https://example.com/ --output reports
```

`inspection-config.json`の例です。目的や気になる点は、確認できた内容だけを記入してください。

```json
{
  "display_name": "サンプルサイト",
  "purpose": "問い合わせ前にサービス内容を伝える",
  "concern": "スマホ幅での情報の見つけやすさ",
  "important_urls": ["https://example.com/contact/"],
  "excluded_urls": ["https://example.com/archive/"],
  "max_pages": 5,
  "timeout_ms": 15000,
  "delay_ms": 500
}
```

| 設定 | 内容 |
| --- | --- |
| `display_name` | 表示名。省略時はホスト名 |
| `purpose` / `concern` | サイトの目的／気になる点。省略時は未確認として扱う |
| `important_urls` | 起点に続いて優先するURL。許可origin内に限定 |
| `excluded_urls` | 対象外にするURL。起点URLは除外不可 |
| `allowed_origins` | 起点以外に許可するoriginの追加一覧。別ホストへのリダイレクトを含む場合も明示する |
| `max_pages` | 1〜20。起点を含むURL数。各URLをPC/SPで観測 |
| `timeout_ms` | 1,000〜60,000ms |
| `delay_ms` | 0〜10,000ms |

`--max-pages`は設定ファイルの値より優先します。ページ数を増やしても、起点からのリンクをさらにたどる再帰巡回にはなりません。

### まずJSONと画像だけ保存する

```bash
npm run inspect -- https://example.com/ --no-pdf
```

現在の`--no-pdf`は、PDFだけでなく**Markdown・HTMLの生成も省略**します。`manifest.json`、観測JSON、画像、`report-content.json`を保存し、後で`npm run report:initial -- <run-dir>`によりレポートを生成できます。

### 自分のローカルデモを使う

ローカルサーバーを別途起動してから実行します。

```bash
npm run inspect -- http://127.0.0.1:3000/ --allow-local
```

`--allow-local`は`localhost`、`127.0.0.1`、`::1`のローカルデモ用です。任意の社内・プライベートIPへの接続を許可する設定ではありません。設定ファイルに`allow_local`を書くだけでは有効になりません。

## 途中終了・取得失敗の読み方

観測の途中でもJSONを順次保存します。`manifest.json`の`status`で実行全体を確認してください。

| 状態 | 意味と扱い |
| --- | --- |
| `running` | 実行中、または強制終了等で終了記録が残っていない。プロセスが終了しているなら未完了として扱う |
| `complete` | 予定したページ・表示条件の取得が完了した。サイト全体に問題がないという意味ではない |
| `partial` | 一部は取得できたが、HTTP応答、検査項目、画像保存等に未完了・要確認がある |
| `failed` | ページを一つも開けなかった場合など、実行に失敗した |
| `interrupted` | SIGINT／SIGTERMによる中断を記録した |

各検査項目の`complete`は情報を取得できたこと、`failed`は取得失敗、`not_run`は未実施を表します。未取得をゼロ件・正常として扱いません。

`running`や`interrupted`で止まったrunから、点検完了とは判断しないでください。自動再開はありません。再点検する場合は`inspect`を再実行し、別runとして保存します。中断箇所によっては`report-content.json`やPDFが未生成のまま残ります。

通常のコマンド終了でも、`partial`が終了コード0になる場合があります。終了コードだけでなく`status`、`errors`、各ページの取得状況を確認してください。レポート生成で失敗した場合も、取得済みのJSONと画像は残ります。

## 開発用の確認

### 型チェックとローカル検証

```bash
npm run typecheck
npm run test:local
```

`test:local`は、初回点検の設定・候補生成・実行記録と、ページ対象・ページ到達・保存パスの検証に対象を絞ります。ローカルHTTPサーバーや応答の差し替えを使い、実際の顧客サイトを巡回しません。ブラウザを使う検証もあるため、Chromiumの準備は必要です。

### 既存のPlaywright検査

**`npm test`はローカル検証だけのコマンドではありません。** `helpers/target.ts`には有効な外部対象の既定設定があり、従来の検査は`is_active: true`の対象へアクセスします。また、サンプルテストにはPlaywright公式サイトへのアクセスがあります。

従来の検査を使う場合は、実行前に`helpers/target.ts`の対象・`is_active`・検査範囲を確認し、自分が意図する対象へ設定してください。新しい`inspect`のURL引数とは独立した設定です。

| コマンド | 役割 |
| --- | --- |
| `npm test` | Chromiumで`tests/`の検査を実行。外部アクセスを含み得る |
| `npm run test:headed` | 同じ検査をブラウザ表示付きで実行 |
| `npm run test:all` | Chromium・Firefox・WebKitの各projectで実行 |
| `npm run report:html` | Playwright TestのHTML結果を開く。初回点検レポートとは別 |
| `npm run report:pdf` | 従来の対象設定に基づき、既存の`reports/<site-id>/report-source.md`をPDFへ変換 |
| `npm run build:cli` | 初回点検CLIをビルド |
| `npm run typecheck:watch` | TypeScriptの型チェックを監視実行 |

`test:all`にはFirefox・WebKitも別途インストールする必要があります。Chromium専用の実行ファイルを環境変数で指定している場合は、その指定を解除してから全ブラウザ検証を行ってください。

従来の`report:pdf`は、新しいrunフォルダを再生成する入口ではありません。初回点検には`report:initial`を使います。

## ブラウザ・ネットワーク環境

### 既存のChrome／Chromiumを使う場合

標準の準備は`npx playwright install chromium`です。ブラウザのダウンロードや展開が利用環境で失敗する場合は、インストール済みの実行ファイルを明示できます。

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/absolute/path/to/chrome npm run inspect -- https://example.com/
```

上記はbash形式の例です。環境変数の指定方法は利用するシェルに合わせてください。`report:initial`や`test:local`でも同じ変数を使います。今回の動作確認では、同梱ブラウザを取得できない環境でChrome 156を指定しています。実際に使用したブラウザのバージョンは`manifest.json`に残ります。

### プロキシ経由でのみ接続できる場合

| 環境変数 | 用途 |
| --- | --- |
| `HTTPS_PROXY` / `HTTP_PROXY` | 初回点検のブラウザ接続に使用するプロキシ。`HTTPS_PROXY`を優先 |
| `NODE_USE_ENV_PROXY=1` | Node.js 24で、DNSのHTTPS照会等の`fetch`にも環境変数のプロキシを使用 |
| `LGWI_DNS_MODE=https` | 通常のDNS名前解決の代わりに、Google公開DNSへHTTPSでA/AAAAを照会 |

プロキシ専用環境で通常のDNS解決ができない場合に、上記を組み合わせます。`LGWI_DNS_MODE=https`は照会先ホスト名をGoogle公開DNSへ送る明示的な選択です。通常環境では未設定のまま使ってください。

どの解決方法でも公開IPアドレスかどうかの判定を行い、DNS確認を省略しません。TLS証明書の検証も無効化していません。ネットワーク制限や外部埋め込みの取得失敗が表示に影響する場合があるため、疑わしい結果は通常の閲覧環境と照合してください。

## 現在の対象外・制約

- 全リンク・外部リンクへのHTTP確認。到達結果を記録するのは、選択したページです。
- フォームへの入力・送信、確認画面の操作、メールの受信到達。
- スマホの実機検証、メニューやボタンの操作確認、新CLIでのFirefox・WebKit検証。
- サイト全体の深い巡回、ログイン後の画面、アクセス制限の回避。
- GA等の分析データ、問い合わせ件数、売上、改善の因果関係の確認。
- WordPressの更新・保守、管理画面、バックアップ・復元、脆弱性診断や適合性の保証。
- CSS背景画像を含む全画像の検査、アクセシビリティの完全な適合判定。
- 定期監視、通知、過去runとの自動差分比較、営業メッセージの送信。

初回点検では、GET・HEAD・OPTIONS以外の通信を抑止し、Service Workerとダウンロードを無効にしています。通常の閲覧と通信条件が異なるため、その条件で取得できた状態として記録します。フォームが存在することと、問い合わせが相手に届くことは区別します。

## 主な実装の場所

| ファイル・ディレクトリ | 役割 |
| --- | --- |
| `scripts/inspect-initial.ts` | URLを受け取り、初回点検とレポート生成を開始 |
| `scripts/render-initial-report.ts` | 保存済みrunからレポートを再生成 |
| `helpers/initial-config.ts` | URL・公開IP・範囲・上限の確認、対象ページの選択 |
| `helpers/initial-inspection.ts` | PC/SP観測、実行状態、チェックポイント、証拠保存 |
| `helpers/initial-findings.ts` | 観測からの候補生成と編集済みレポートJSONの検証 |
| `helpers/initial-report-renderer.ts` | Markdown・HTML・PDFの生成 |
| `types/initial-report.ts` | 設定、manifest、観測、候補、レポートの型 |
| `inspectors/` | meta・heading・link・image・formの情報収集 |
| `helpers/target.ts` | 従来のPlaywright検査の対象設定 |
| `tests/` | ローカル検証と従来のサイト検査 |
| `tsconfig.cli.json` | 初回点検CLI用のビルド設定 |

観測事実、事業への影響の仮説、提案を分け、根拠をたどれる状態で残すことを重視しています。自動抽出した候補は、人間が画面と目的を確認してから採用します。
