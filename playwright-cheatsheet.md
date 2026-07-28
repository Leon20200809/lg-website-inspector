# Playwright 実戦メモ：LG流「何を狙い、どこで動き、何が返るか」

> 暗記用のAPI一覧ではなく、実際のテストコードを読んで書くための作戦メモ。  
> まず「何をしたいか」を日本語で決め、対象・実行場所・戻り値を確認する。

---

## 0. 最初に覚える全体像

Playwrightでは、コードが動く場所が2つある。

```text
Node.js側
├─ Playwrightのテストコード
├─ page / locator / expect
├─ importした型・定数
├─ JSONの集計・保存
└─ テスト全体の指揮

ブラウザ側
├─ 検査対象ページ
├─ window / document
├─ HTML要素
├─ currentSrc / naturalWidth / complete
└─ 実際に表示されたDOMの状態
```

LG司令官メタで表すとこうなる。

```text
Node.js側
→ 司令部

ブラウザ側
→ 現地調査部隊
```

司令部はPlaywrightへ命令し、現地のブラウザから事実を持ち帰る。

---

# 1. Locatorは「ロックオン」

```ts
const images = page.locator("img");
```

## 日本語

> ページ内の`img`要素を、今後の操作・調査対象として指定する。

## イメージ

```text
page.locator("img")
→ 画像をロックオン
```

ただし、ここで画像を取得・クリック・調査したわけではない。

`Locator`は、実物のDOM要素そのものではなく、

```text
「この条件に一致する要素を、その時点で探せ」
```

という照準情報に近い。

Playwrightは、実際に操作や確認を行う時点で対象を探し直す。  
そのため、ページが再描画されても比較的壊れにくい。

## 引数と戻り値

```ts
page.locator(selector);
```

| 項目     | 内容                                   |
| -------- | -------------------------------------- |
| 引数     | `selector: string`                     |
| 戻り値   | `Locator`                              |
| `await`  | 不要                                   |
| 実行場所 | 指示はNode.js側。対象はブラウザ内のDOM |
| 仕事     | 対象条件を作る                         |

## 実例

```ts
const imageLocators = page.locator("img");
const formLocators = page.locator("form");
const linkLocators = page.locator("a[href]");
```

---

# 2. Locatorを絞り込む

## locator.first()

```ts
const firstImage = page.locator("img").first();
```

### 日本語

> ロックオンした候補のうち、最初の1件を対象にする。

| 項目     | 内容                   |
| -------- | ---------------------- |
| 引数     | なし                   |
| 戻り値   | `Locator`              |
| `await`  | 不要                   |
| イメージ | 先頭の標的へ照準を絞る |

---

## locator.nth()

```ts
const image = page.locator("img").nth(index);
```

### 日本語

> ロックオンした候補のうち、指定番号の1件を対象にする。

| 項目    | 内容             |
| ------- | ---------------- |
| 引数    | `index: number`  |
| 戻り値  | `Locator`        |
| `await` | 不要             |
| 注意    | `index`は0始まり |

```ts
page.locator("img").nth(0); // 1枚目
page.locator("img").nth(1); // 2枚目
```

---

## locator.count()

```ts
const imageCount = await page.locator("img").count();
```

### 日本語

> ロックオン条件に一致する要素が何件あるか数える。

| 項目     | 内容               |
| -------- | ------------------ |
| 引数     | なし               |
| 戻り値   | `Promise<number>`  |
| `await`  | 必要               |
| イメージ | 標的数を報告させる |

---

# 3. evaluate()とevaluateAll()は「現地調査命令」

## まず結論

```text
locator()
→ ロックオン

evaluate()
→ 1つの対象へ現地調査命令を出す

evaluateAll()
→ ロックオンした全対象へ一斉調査命令を出す
```

「発射」「全弾発射」というイメージでも覚えられる。

ただし、`evaluate()`自体はクリックや攻撃をする関数ではない。  
中に渡した関数をブラウザ側で実行するための発射装置だ。

```text
何を発射するか
→ コールバック関数の中身で決まる
```

画像情報を読むなら「全調査員を投入」。  
DOMを書き換える処理なら「全対象へ命令」。  
実際の仕事はコールバック次第。

---

## locator.evaluate()

```ts
const result = await locator.evaluate((element) => {
  return element.textContent;
});
```

### 日本語

> ロックオンした1要素をブラウザ側で調べ、結果をNode.js側へ返す。

| 項目     | 内容                       |
| -------- | -------------------------- |
| 第1引数  | ブラウザ側で実行する関数   |
| 第2引数  | ブラウザ側へ渡す任意データ |
| 戻り値   | `Promise<Serializable>`    |
| `await`  | 必要                       |
| 対象     | 1要素                      |
| 実行場所 | コールバック内はブラウザ側 |

### 例

```ts
const imageWidth = await imageLocator.evaluate((element) => {
  const image = element as HTMLImageElement;

  return image.naturalWidth;
});
```

処理の流れ。

```text
Node.js側
「この画像のnaturalWidthを調べろ」
        ↓
ブラウザ側
HTMLImageElementを調査
        ↓
numberを返す
        ↓
Node.js側
imageWidthへ代入
```

---

## locator.evaluateAll()

```ts
const images = await page.locator("img").evaluateAll((elements) => {
  return elements.map((element, index) => {
    const image = element as HTMLImageElement;

    return {
      order: index + 1,
      src: image.getAttribute("src"),
    };
  });
});
```

### 日本語

> ロックオン条件に一致する全要素をブラウザ側で一括調査し、結果をNode.js側へ返す。

| 項目     | 内容                           |
| -------- | ------------------------------ |
| 第1引数  | 全対象を処理するブラウザ側関数 |
| 第2引数  | ブラウザ側へ渡す任意データ     |
| 戻り値   | `Promise<Serializable>`        |
| `await`  | 必要                           |
| 対象     | 一致した全要素                 |
| 実行場所 | コールバック内はブラウザ側     |

### コールバックの第1引数

```ts
(elements) => {
```

`elements`には、`locator("img")`に一致したDOM要素が配列で入る。

```text
elements
├─ 1枚目のimg
├─ 2枚目のimg
├─ 3枚目のimg
└─ ...
```

### 一斉射撃メタ

```text
page.locator("img")
→ 全imgをロックオン

.evaluateAll(...)
→ 全対象へ一斉調査命令

elements.map(...)
→ 1件ずつ同じ調査を実行

return [...]
→ 調査結果をまとめて司令部へ返す
```

---

# 4. なぜevaluateAll()内でDOMを調べるのか

次の値は、ブラウザが実際にページを表示した結果として持っている。

```ts
image.currentSrc;
image.complete;
image.naturalWidth;
image.naturalHeight;
```

## currentSrc

```ts
image.currentSrc;
```

`srcset`や画面幅などを考慮して、ブラウザが実際に選んだ画像URL。

HTML上の生の`src`とは異なることがある。

```ts
image.getAttribute("src"); // HTMLに書かれた値
image.currentSrc; // ブラウザが実際に選んだ値
```

---

## complete

```ts
image.complete;
```

ブラウザの画像読込処理が終了しているかを示す。

注意点：

```text
complete === true
```

だけでは、正常読込とは限らない。  
画像切れでも読込処理自体は終了している場合がある。

---

## naturalWidth / naturalHeight

```ts
image.naturalWidth;
image.naturalHeight;
```

実際に読み込まれた画像本来のサイズ。

```text
naturalWidth > 0
かつ
naturalHeight > 0
```

なら、実画像を取得できている強い根拠になる。

---

# 5. Node.js側の変数をそのまま使えない理由

```ts
import { IMAGE_ALT_STATUS } from "../types/image-summary";
```

これはNode.js側のテストコードでimportしている。

一方、`evaluateAll()`のコールバックはブラウザ側で実行される。

```text
Node.js側の世界
→ IMAGE_ALT_STATUSを知っている

ブラウザ側の世界
→ そのimportを知らない
```

そのため、次のように外側の変数を直接参照する設計は避ける。

```ts
await page.locator("img").evaluateAll((elements) => {
  // ブラウザ側では外部のimport変数を直接使えない
  return IMAGE_ALT_STATUS.MISSING;
});
```

必要な値は、第2引数で渡す。

```ts
const images = await page.locator("img").evaluateAll(
  (elements, statuses) => {
    return elements.map((element) => {
      const image = element as HTMLImageElement;
      const alt = image.getAttribute("alt");

      return {
        alt,
        alt_status: alt === null ? statuses.alt.MISSING : statuses.alt.PRESENT,
      };
    });
  },
  {
    alt: IMAGE_ALT_STATUS,
  },
);
```

## データの移動

```text
Node.js側

{
  alt: IMAGE_ALT_STATUS
}

        ↓ 第2引数で転送

ブラウザ側

statuses.alt.MISSING
statuses.alt.PRESENT
```

`statuses`という名前はPlaywright固定ではない。

```ts
(elements, rules) => {
  rules.alt.MISSING;
};
```

でも動く。

---

# 6. ブラウザ側へ渡せるもの

基本は、シリアライズできるデータを渡す。

```ts
string;
number;
boolean;
null;
配列;
単純なオブジェクト;
```

今回の状態定数は単純なオブジェクトなので渡せる。

```ts
{
  PRESENT: "present",
  EMPTY: "empty",
  MISSING: "missing",
}
```

一方、Node.jsの関数・ファイル操作・import済みモジュールを、そのままブラウザ側へ持ち込むものではない。

```text
Node.js側
→ fs、path、JSON保存、importした処理

ブラウザ側
→ window、document、HTMLElement、DOM調査
```

役割を混ぜない。

---

# 7. evaluateAll()の戻り値と型

```ts
const images: ImageItem[] =
  await page.locator("img").evaluateAll(...);
```

## ImageItem

```text
ImageItem
→ 画像1枚分の検査結果
```

## ImageItem[]

```text
ImageItem[]
→ ページ内の画像すべての検査結果
```

## await

`evaluateAll()`の処理は非同期なので、結果は最初に`Promise`として返る。

```text
ブラウザへ命令を送る
↓
全imgを調査
↓
結果を配列化
↓
Node.jsへ返送
```

この完了を待つのが`await`。

```ts
const images = await ...;
```

## 型注釈の注意

```ts
const images: ImageItem[];
```

はTypeScript上の契約。

できること：

```text
入力補完
プロパティ漏れの検出
型違いの検出
リファクタリング支援
```

できないこと：

```text
実行時に外部データを自動検証する
```

型は作戦仕様書だが、実行時バリデーションそのものではない。

---

# 8. 実戦例：画像検査

```ts
const images: ImageItem[] = await page.locator("img").evaluateAll(
  (elements, statuses) => {
    return elements.map((element, index) => {
      const image = element as HTMLImageElement;
      const alt = image.getAttribute("alt");

      let altStatus = statuses.alt.PRESENT;

      if (alt === null) {
        altStatus = statuses.alt.MISSING;
      } else if (alt.trim() === "") {
        altStatus = statuses.alt.EMPTY;
      }

      const hasNaturalSize = image.naturalWidth > 0 && image.naturalHeight > 0;

      let loadStatus = statuses.load.UNKNOWN;

      if (hasNaturalSize) {
        loadStatus = statuses.load.LOADED;
      } else if (image.loading === "lazy" && image.currentSrc === "") {
        loadStatus = statuses.load.NOT_LOADED;
      } else if (image.complete && image.currentSrc !== "") {
        loadStatus = statuses.load.BROKEN;
      }

      return {
        order: index + 1,
        src: image.getAttribute("src"),
        current_src: image.currentSrc,
        alt,
        alt_status: altStatus,
        loading: image.getAttribute("loading"),
        complete: image.complete,
        load_status: loadStatus,
        loaded: loadStatus === statuses.load.LOADED,
        natural_width: image.naturalWidth,
        natural_height: image.naturalHeight,
      };
    });
  },
  {
    alt: IMAGE_ALT_STATUS,
    load: IMAGE_LOAD_STATUS,
  },
);
```

## 日本語で読む

```text
全imgをロックオンする
↓
ブラウザ側へ一斉調査命令を出す
↓
画像を1枚ずつImageItemへ変換する
↓
alt状態を判定する
↓
読込状態を判定する
↓
ImageItem[]をNode.js側へ返す
```

## この関数のGOAL

```text
ImageItem[]を完成させる
```

`ImageItem`の各項目を埋めるために、必要なDOM情報だけを取得する。

---

# 9. ページを開く

## page.goto()

```ts
const response = await page.goto(url, options);
```

### 日本語

> 指定URLへ移動し、ページのメインHTTPレスポンスを受け取る。

| 項目     | 内容                             |
| -------- | -------------------------------- |
| 第1引数  | `url: string`                    |
| 第2引数  | `options?: object`               |
| 戻り値   | `Promise<Response \| null>`      |
| `await`  | 必要                             |
| 主な用途 | ページを開く、HTTP状態を確認する |

### 実戦例

```ts
const response = await page.goto(targetSite.base_url, {
  waitUntil: "domcontentloaded",
});

if (response === null) {
  summary.errors.push("HTTPレスポンスを取得できませんでした");
} else if (!response.ok()) {
  summary.errors.push(`HTTP ${response.status()}`);
}
```

### waitUntilの考え方

```text
domcontentloaded
→ HTMLの解析が終わった

load
→ 画像やCSSなどを含むloadイベントが発火した

networkidle
→ 通信が静かになるまで待つ
```

通常のテストで`networkidle`へ依存しすぎない。  
常時通信・解析タグ・チャットなどがあるページでは安定しにくい。

LG流では、

```text
ページを開く
→ 必要な対象や状態を個別に待つ
```

を基本にする。

---

## page.url()

```ts
const currentUrl = page.url();
```

### 日本語

> ブラウザが現在表示しているURLを、その場で取得する。

| 項目    | 内容            |
| ------- | --------------- |
| 引数    | なし            |
| 戻り値  | `string`        |
| `await` | 不要            |
| 注意    | Promiseではない |

リダイレクト後の実URLを記録するときに使う。

```ts
summary.page_url = page.url();
```

---

## page.title()

```ts
const title = await page.title();
```

### 日本語

> 現在のページの`document.title`を取得する。

| 項目    | 内容              |
| ------- | ----------------- |
| 引数    | なし              |
| 戻り値  | `Promise<string>` |
| `await` | 必要              |

---

## page.goBack()

```ts
const response = await page.goBack(options);
```

### 日本語

> ブラウザ履歴を1つ戻り、戻ったページのレスポンスを受け取る。

| 項目    | 内容                        |
| ------- | --------------------------- |
| 引数    | `options?: object`          |
| 戻り値  | `Promise<Response \| null>` |
| `await` | 必要                        |

---

# 10. 読込状態を待つ

## page.waitForLoadState()

```ts
await page.waitForLoadState("load");
```

### 日本語

> ページが指定した読込段階へ到達するまで待つ。

| 項目    | 内容                                                  |
| ------- | ----------------------------------------------------- |
| 引数    | `"load"` / `"domcontentloaded"` / `"networkidle"`など |
| 戻り値  | `Promise<void>`                                       |
| `await` | 必要                                                  |

### 戻り値がvoidの意味

情報を返す関数ではなく、

```text
条件が整うまで処理を止める
```

関数だから。

```ts
await page.waitForLoadState("load");
```

が完了した時点で、次の命令へ進める。

---

# 11. 要素から事実を取得する

## locator.getAttribute()

```ts
const alt = await locator.getAttribute("alt");
```

### 日本語

> 対象要素のHTML属性を、そのまま取得する。

| 項目    | 内容                      |
| ------- | ------------------------- |
| 引数    | `name: string`            |
| 戻り値  | `Promise<string \| null>` |
| `await` | 必要                      |

### nullと空文字の違い

```html
<img />
```

```ts
getAttribute("alt");
// null
```

```html
<img alt="" />
```

```ts
getAttribute("alt");
// ""
```

この違いを残すことで、

```text
alt属性なし
alt属性はあるが空
```

を区別できる。

---

## locator.textContent()

```ts
const text = await locator.textContent();
```

### 日本語

> 対象ノードの`textContent`を取得する。

| 項目    | 内容                      |
| ------- | ------------------------- |
| 引数    | なし                      |
| 戻り値  | `Promise<string \| null>` |
| `await` | 必要                      |

表示上の文字だけではなく、子要素内の文字も含むことがある。

---

## locator.isVisible()

```ts
const isVisible = await locator.isVisible();
```

### 日本語

> 対象要素が現在見える状態か、その場で確認する。

| 項目    | 内容                                   |
| ------- | -------------------------------------- |
| 引数    | なし                                   |
| 戻り値  | `Promise<boolean>`                     |
| `await` | 必要                                   |
| 重要    | 表示されるまで待たず、現在の状態を返す |

```ts
if (!isVisible) {
  continue;
}
```

これは、

> 非表示なら次の対象へ進め

という制御に使える。

---

# 12. expectは「合否判定」

## Locatorとexpectの役割

```text
locator
→ 対象をロックオンする

expect
→ 期待状態になるまで確認し、合否判定する
```

PlaywrightのWeb向け`expect`は、期待状態になるまで再確認する。

---

## expect(locator).toBeVisible()

```ts
await expect(locator).toBeVisible();
```

### 日本語

> 対象が表示されるまで再確認し、時間内に表示されなければ失敗にする。

| 項目    | 内容               |
| ------- | ------------------ |
| 引数    | 任意のoptions      |
| 戻り値  | `Promise<void>`    |
| `await` | 必要               |
| 仕事    | 待機を含む合否判定 |

### isVisible()との違い

```ts
const visible = await locator.isVisible();
```

```text
現在の事実を即確認
→ booleanを返す
```

```ts
await expect(locator).toBeVisible();
```

```text
表示されるまで再確認
→ 成功ならvoid
→ 失敗ならテストエラー
```

---

## expect(page).toHaveTitle()

```ts
await expect(page).toHaveTitle(/会社概要/);
```

### 日本語

> ページタイトルが期待値に一致するまで確認し、合否判定する。

| 項目    | 内容                   |
| ------- | ---------------------- |
| 引数    | `string`または`RegExp` |
| 戻り値  | `Promise<void>`        |
| `await` | 必要                   |

---

## expect(page).toHaveURL()

```ts
await expect(page).toHaveURL(/contact/);
```

### 日本語

> 現在URLが期待値に一致するまで確認し、合否判定する。

| 項目    | 内容                   |
| ------- | ---------------------- |
| 引数    | `string`または`RegExp` |
| 戻り値  | `Promise<void>`        |
| `await` | 必要                   |

---

## expect(locator).toContainText()

```ts
await expect(locator).toContainText("送信しました");
```

### 日本語

> 対象内に期待する文字列が現れるまで確認し、合否判定する。

| 項目    | 内容                   |
| ------- | ---------------------- |
| 引数    | `string`または`RegExp` |
| 戻り値  | `Promise<void>`        |
| `await` | 必要                   |

---

# 13. 画面サイズと証拠保存

## page.setViewportSize()

```ts
await page.setViewportSize({
  width: 1440,
  height: 900,
});
```

### 日本語

> ブラウザ表示領域の幅と高さを指定する。

| 項目    | 内容                                |
| ------- | ----------------------------------- |
| 引数    | `{ width: number; height: number }` |
| 戻り値  | `Promise<void>`                     |
| `await` | 必要                                |

用途：

```text
PC表示の確認
スマホ表示の確認
レスポンシブ切替の再現
スクリーンショット条件の固定
```

---

## page.screenshot()

```ts
const buffer = await page.screenshot({
  fullPage: true,
});
```

### 日本語

> 現在のページ表示を画像として取得する。

| 項目    | 内容               |
| ------- | ------------------ |
| 引数    | `options?: object` |
| 戻り値  | `Promise<Buffer>`  |
| `await` | 必要               |

ファイルへ直接保存する場合。

```ts
await page.screenshot({
  path: "reports/page.png",
  fullPage: true,
});
```

---

# 14. 戻り値で関数の仕事を見抜く

## `Locator`

```ts
page.locator("img");
```

```text
対象を指定した
まだ実行結果ではない
```

---

## `Promise<number>`

```ts
locator.count();
```

```text
非同期で数値を取得する
await後にnumber
```

---

## `Promise<string | null>`

```ts
locator.getAttribute("alt");
```

```text
非同期で属性値を取得する
属性なしならnull
```

---

## `Promise<void>`

```ts
page.waitForLoadState("load");
expect(locator).toBeVisible();
```

```text
情報を返すのではなく、
待機・操作・判定の完了を表す
```

---

## `Promise<Response | null>`

```ts
page.goto(url);
page.goBack();
```

```text
移動完了後、
HTTPレスポンスまたはnullを返す
```

---

## `string`

```ts
page.url();
```

```text
現在値を同期的に取得する
await不要
```

---

# 15. LG流：コードを読む順番

Playwrightの1行を見たら、次の順で読む。

```text
1. 誰が命令しているか
2. 何を対象にしているか
3. どこで処理が動くか
4. 何を返すか
5. awaitが必要か
6. その結果を何に使うか
```

## 例

```ts
const images: ImageItem[] =
  await page.locator("img").evaluateAll(...);
```

### 分解

```text
誰が
→ page

何を対象に
→ img

どう指定
→ locatorでロックオン

どこで調査
→ evaluateAll内はブラウザ側

何を返す
→ ImageItem[]

await
→ ブラウザ調査の完了待ち

何に使う
→ summary集計とJSON保存
```

---

# 16. LG流：関数を作る順番

```text
1. GOALとなる型を見る
2. 日本語で仕事を1文にする
3. 必要な入力を決める
4. 戻り値を決める
5. どちらの世界で動くか決める
6. 必要なPlaywright APIだけ選ぶ
7. 最小実装
8. typecheck
9. テスト
10. JSONで事実を比較
```

## 画像検査の例

```text
GOAL
→ ImageItem[]を完成させる

必要な入力
→ Page

対象
→ img要素

ロックオン
→ page.locator("img")

一斉調査
→ evaluateAll()

結果
→ Promise<ImageItem[]>
```

関数へするとこうなる。

```ts
export async function collectImageItems(page: Page): Promise<ImageItem[]> {
  return page
    .locator("img")
    .evaluateAll
    // ブラウザ側でImageItem[]を作る
    ();
}
```

---

# 17. 最重要早見表

| API                         | LGイメージ         | 実際の仕事               | 戻り値                      |
| --------------------------- | ------------------ | ------------------------ | --------------------------- |
| `page.locator()`            | ロックオン         | 対象条件を作る           | `Locator`                   |
| `locator.first()`           | 先頭へ照準         | 最初の対象へ絞る         | `Locator`                   |
| `locator.nth()`             | 指定番号へ照準     | 1件へ絞る                | `Locator`                   |
| `locator.count()`           | 標的数報告         | 件数取得                 | `Promise<number>`           |
| `locator.evaluate()`        | 精密調査命令       | 1要素をブラウザ側で処理  | `Promise<Serializable>`     |
| `locator.evaluateAll()`     | 全弾発射・一斉調査 | 全要素をブラウザ側で処理 | `Promise<Serializable>`     |
| `locator.getAttribute()`    | 属性回収           | HTML属性取得             | `Promise<string \| null>`   |
| `locator.textContent()`     | 文字回収           | textContent取得          | `Promise<string \| null>`   |
| `locator.isVisible()`       | 現況報告           | 現在の表示状態を即取得   | `Promise<boolean>`          |
| `expect(...).toBeVisible()` | 合否判定           | 表示まで再確認           | `Promise<void>`             |
| `page.goto()`               | 現場へ移動         | URLを開く                | `Promise<Response \| null>` |
| `page.waitForLoadState()`   | 到着待機           | 読込段階を待つ           | `Promise<void>`             |
| `page.url()`                | 現在地確認         | 現URL取得                | `string`                    |
| `page.title()`              | 表札確認           | title取得                | `Promise<string>`           |
| `page.screenshot()`         | 証拠写真           | 画面保存                 | `Promise<Buffer>`           |

---

# 18. 一言で覚える

```text
locator
→ 狙う

first / nth
→ 絞る

count
→ 数える

evaluate
→ 現地で1件調べる

evaluateAll
→ 現地で全部調べる

getAttribute / textContent
→ 事実を持ち帰る

expect
→ 合否判定する

goto
→ 現場へ向かう

waitForLoadState
→ 到着を待つ

screenshot
→ 証拠を残す
```

---

# 19. 今回の核心

```ts
const images: ImageItem[] =
  await page.locator("img").evaluateAll(...);
```

LG流の読み方。

```text
全imgをロックオン
↓
ブラウザ側へ一斉調査命令
↓
ImageItem形式で全件報告
↓
司令部がImageItem[]として受領
↓
summaryへ集計
↓
JSONへ証拠保存
```

> `locator()`は照準器。  
> `evaluateAll()`は全対象への一斉調査命令。  
> `ImageItem[]`は帰還した調査報告書。
