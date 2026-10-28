import type { Page } from "@playwright/test";

import {
  IMAGE_ALT_STATUS,
  IMAGE_LOAD_STATUS,
  ImageAltStatus,
} from "../types/image-summary";

import type {
  ImageItem,
  ImageLoadStatus,
  ImageSummary,
} from "../types/image-summary";

/**
 * ページを上部から下部まで段階的にスクロールする。
 *
 * 人間がページを順番に閲覧する状態を再現し、
 * 画面内への進入を条件とするlazy画像の読み込みを促す。
 *
 * 特定の画像要素を直接操作せず、
 * ページ全体を一定量ずつスクロールする。
 *
 * @param page 検査対象ページを操作するPlaywrightのPage
 */
export async function scrollThroughPage(page: Page): Promise<void> {
  const MAX_SCROLL_COUNT = 100;
  const SCROLL_WAIT_MS = 150;

  let previousScrollHeight = 0;

  // 検査開始位置をページ上部へ統一する
  await page.evaluate(() => {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "instant",
    });
  });

  for (let count = 0; count < MAX_SCROLL_COUNT; count++) {
    // 現在のスクロール位置とページサイズを取得する
    const scrollState = await page.evaluate(() => {
      return {
        scrollY: window.scrollY,
        viewportHeight: window.innerHeight,
        scrollHeight: document.documentElement.scrollHeight,
      };
    });

    const reachedBottom =
      scrollState.scrollY + scrollState.viewportHeight >=
      scrollState.scrollHeight;

    const scrollHeightStopped =
      scrollState.scrollHeight === previousScrollHeight;

    // 最下部に到達し、ページの高さも変化しなくなったら終了する
    if (reachedBottom && scrollHeightStopped) {
      break;
    }

    previousScrollHeight = scrollState.scrollHeight;

    // 画面の約8割ずつ下へ移動する
    await page.evaluate(
      (scrollAmount) => {
        window.scrollBy({
          top: scrollAmount,
          left: 0,
          behavior: "instant",
        });
      },
      Math.floor(scrollState.viewportHeight * 0.8),
    );

    // スクロールによる画像読込とDOM更新を待つ
    await page.waitForTimeout(SCROLL_WAIT_MS);
  }

  // 最下部付近のlazy画像が読み始める時間を確保する
  await page.waitForTimeout(500);
}

/**
 * 表示されている各画像の読み込みが、成功・失敗・タイムアウトのいずれかになるまで待つ。
 *
 * display:noneなどの非表示画像は待機対象から除外する。
 *
 * @param page 検査対象ページを操作するPlaywrightのPage
 */
export async function waitForVisibleImageLoadResults(
  page: Page,
): Promise<void> {
  const imageLocators = page.locator("img");
  const imageCount = await imageLocators.count();

  for (let index = 0; index < imageCount; index++) {
    const imageLocator = imageLocators.nth(index);

    // 要素が利用者から見える状態かを、待機せず確認する
    const isVisible = await imageLocator.isVisible();

    // display:noneなどの非表示画像は待機対象から除外する
    if (!isVisible) {
      continue;
    }

    // 画像の読み込み成功または失敗が確定するまで待つ
    await imageLocator.evaluate((element) => {
      const image = element as HTMLImageElement;

      return new Promise<void>((resolve) => {
        // すでに読み込み結果が出ていれば待たない
        if (image.complete) {
          resolve();
          return;
        }

        image.addEventListener("load", () => resolve(), {
          once: true,
        });

        image.addEventListener("error", () => resolve(), {
          once: true,
        });

        // 独自lazy処理などでイベントが返らない場合の保険
        setTimeout(() => resolve(), 5000);
      });
    });
  }
}

/**
 * ページ内に存在するすべてのimg要素から画像情報を収集する。
 *
 * src・currentSrc・alt・loading・complete・
 * naturalWidth・naturalHeightを取得し、
 * alt属性と読み込み状態を分類する。
 *
 * 画像の内容そのものは解析せず、
 * DOMとブラウザが保持する技術情報だけを返す。
 *
 * @param page 検査対象ページを操作するPlaywrightのPage
 * @returns ページ内に存在する画像情報の配列
 */
export async function collectImageItems(page: Page): Promise<ImageItem[]> {
  const images: ImageItem[] = await page.locator("img").evaluateAll(
    (elements, statuses) => {
      // 取得したimg要素を1枚ずつImageItem形式へ変換する
      return elements.map((element, index) => {
        // 汎用的なElementを画像専用のHTMLImageElementとして扱う
        const image = element as HTMLImageElement;

        // alt属性なしはnull、alt=""は空文字として取得される
        const alt = image.getAttribute("alt");

        // alt属性の状態は、まず「文字あり」を初期値にする
        let altStatus: ImageAltStatus = statuses.alt.PRESENT;

        // alt属性そのものが存在しない
        if (alt === null) {
          altStatus = statuses.alt.MISSING;
        }
        // alt属性は存在するが、中身が空文字
        else if (alt.trim() === "") {
          altStatus = statuses.alt.EMPTY;
        }

        // 実画像の幅と高さが取得できているか確認する
        const hasNaturalSize =
          image.naturalWidth > 0 && image.naturalHeight > 0;

        // 現在の情報だけでは判断できない状態から開始する
        let loadStatus: ImageLoadStatus = statuses.load.UNKNOWN;

        // 実画像の幅と高さが取れていれば正常読込
        if (hasNaturalSize) {
          loadStatus = statuses.load.LOADED;
        }
        // lazy画像でcurrentSrcが空なら、まだ読み込まれていない
        else if (image.loading === "lazy" && image.currentSrc === "") {
          loadStatus = statuses.load.NOT_LOADED;
        }
        // 読込処理が完了し、URLもあるのに実寸が0なら画像切れ候補
        else if (image.complete && image.currentSrc !== "") {
          loadStatus = statuses.load.BROKEN;
        }

        // load_statusから、従来のboolean値も作成する
        const loaded = loadStatus === statuses.load.LOADED;

        // 画像1枚分の検査結果を返す
        return {
          // DOM上での出現順。indexは0始まりなので1を足す
          order: index + 1,

          // HTMLに書かれているsrc属性
          src: image.getAttribute("src"),

          // srcsetなどを考慮してブラウザが実際に選んだURL
          current_src: image.currentSrc,

          // alt属性の実際の値
          alt,

          // alt属性あり・空・欠落の分類結果
          alt_status: altStatus,

          // lazyやeagerなどの読み込み指定
          loading: image.getAttribute("loading"),

          // ブラウザの画像読込処理が終了したか
          complete: image.complete,

          // 正常・未読込・画像切れなどの詳細状態
          load_status: loadStatus,

          // 正常に読み込めたかをbooleanでも保存する
          loaded,

          // 読み込まれた実画像本来のサイズ
          natural_width: image.naturalWidth,
          natural_height: image.naturalHeight,
        };
      });
    },

    // Node.js側の定数を、ブラウザ側の処理へ渡す。
    // evaluateAll()内ではIMAGE_ALT_STATUSを直接参照せず、
    // statuses.altやstatuses.loadを通して使用する。
    {
      alt: IMAGE_ALT_STATUS,
      load: IMAGE_LOAD_STATUS,
    },
  );
  return images;
}

/**
 * 収集した画像情報を、ページ全体の集計結果へ反映する。
 *
 * 画像総数・alt属性欠落数・空alt数・
 * 読み込み失敗画像数を集計し、ImageSummaryを更新する。
 *
 * @param summary 更新対象となる画像検査結果
 * @param images ページ内から収集した画像情報
 */
export function applyImageSummary(
  summary: ImageSummary,
  images: ImageItem[],
): void {
  // 各画像の根拠データを集計結果へ保存する
  summary.images = images;

  // ページ内に存在するimg要素の総数
  summary.total_images = images.length;

  // alt属性そのものが存在しない画像数
  summary.missing_alt_count = images.filter(
    (image) => image.alt_status === IMAGE_ALT_STATUS.MISSING,
  ).length;

  // alt属性は存在するが空文字の画像数
  summary.empty_alt_count = images.filter(
    (image) => image.alt_status === IMAGE_ALT_STATUS.EMPTY,
  ).length;

  // 読み込み失敗と判定された画像数
  summary.broken_image_count = images.filter(
    (image) => image.load_status === IMAGE_LOAD_STATUS.BROKEN,
  ).length;
}
