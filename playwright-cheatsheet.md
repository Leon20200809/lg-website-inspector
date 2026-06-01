# Playwright 関数メモ：引数と戻り値

## page.goto()

```ts
page.goto(url, options?)
```

| 項目   | 内容                          |
| ---- | --------------------------- |
| 引数   | `url: string`               |
| 任意引数 | `options?: object`          |
| 戻り値  | `Promise<Response \| null>` |

---

## page.title()

```ts
page.title()
```

| 項目  | 内容                |
| --- | ----------------- |
| 引数  | なし                |
| 戻り値 | `Promise<string>` |

---

## expect(page).toHaveTitle()

```ts
expect(page).toHaveTitle(titleOrRegExp)
```

| 項目  | 内容                    |
| --- | --------------------- |
| 引数  | `string` または `RegExp` |
| 戻り値 | `Promise<void>`       |

---

## page.locator()

```ts
page.locator(selector)
```

| 項目  | 内容                 |
| --- | ------------------ |
| 引数  | `selector: string` |
| 戻り値 | `Locator`          |

---

## locator.first()

```ts
locator.first()
```

| 項目  | 内容        |
| --- | --------- |
| 引数  | なし        |
| 戻り値 | `Locator` |

---

## expect(locator).toBeVisible()

```ts
expect(locator).toBeVisible()
```

| 項目  | 内容              |
| --- | --------------- |
| 引数  | なし              |
| 戻り値 | `Promise<void>` |

---

## page.screenshot()

```ts
page.screenshot(options?)
```

| 項目  | 内容                 |
| --- | ------------------ |
| 引数  | `options?: object` |
| 戻り値 | `Promise<Buffer>`  |

---

## page.setViewportSize()

```ts
page.setViewportSize(size)
```

| 項目  | 内容                                  |
| --- | ----------------------------------- |
| 引数  | `{ width: number; height: number }` |
| 戻り値 | `Promise<void>`                     |

---

## expect(page).toHaveURL()

```ts
expect(page).toHaveURL(urlOrRegExp)
```

| 項目  | 内容                    |
| --- | --------------------- |
| 引数  | `string` または `RegExp` |
| 戻り値 | `Promise<void>`       |

---

## expect(locator).toContainText()

```ts
expect(locator).toContainText(textOrRegExp)
```

| 項目  | 内容                    |
| --- | --------------------- |
| 引数  | `string` または `RegExp` |
| 戻り値 | `Promise<void>`       |

---

## locator.count()

```ts
locator.count()
```

| 項目  | 内容                |
| --- | ----------------- |
| 引数  | なし                |
| 戻り値 | `Promise<number>` |

---

## locator.nth()

```ts
locator.nth(index)
```

| 項目  | 内容              |
| --- | --------------- |
| 引数  | `index: number` |
| 戻り値 | `Locator`       |

---

## locator.getAttribute()

```ts
locator.getAttribute(name)
```

| 項目  | 内容                        |
| --- | ------------------------- |
| 引数  | `name: string`            |
| 戻り値 | `Promise<string \| null>` |

---

## locator.textContent()

```ts
locator.textContent()
```

| 項目  | 内容                        |
| --- | ------------------------- |
| 引数  | なし                        |
| 戻り値 | `Promise<string \| null>` |

---

## page.url()

```ts
page.url()
```

| 項目  | 内容       |
| --- | -------- |
| 引数  | なし       |
| 戻り値 | `string` |

---

## page.goBack()

```ts
page.goBack(options?)
```

| 項目  | 内容                          |
| --- | --------------------------- |
| 引数  | `options?: object`          |
| 戻り値 | `Promise<Response \| null>` |

---

## page.waitForLoadState()

```ts
page.waitForLoadState(state?)
```

| 項目  | 内容                                                    |
| --- | ----------------------------------------------------- |
| 引数  | `'load'` または `'domcontentloaded'` または `'networkidle'` |
| 戻り値 | `Promise<void>`                                       |
