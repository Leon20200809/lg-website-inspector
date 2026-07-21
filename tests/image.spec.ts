/**
 * ページ内の画像情報を取得し、
 * image-summary.jsonへ保存する。
 */

import { test, expect } from "@playwright/test";

import { getActiveTargetSites } from "../helpers/target";
import { getSummaryJsonPath, SUMMARY_FILES } from "../helpers/report-paths";
import { saveJsonFile } from "../helpers/json-file";
import { getJapanIsoString } from "../helpers/date";

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

const activeSites = getActiveTargetSites();

activeSites.forEach((targetSite) => {
  test(`${targetSite.name} の画像情報を収集する`, async ({ page }) => {
    const summaryPath = getSummaryJsonPath(targetSite.id, SUMMARY_FILES.image);

    // 検査結果の初期値を作成
    const summary: ImageSummary = {
      site_id: targetSite.id,
      site_name: targetSite.name,
      base_url: targetSite.base_url,
      page_url: targetSite.base_url,
      inspected_at: getJapanIsoString(),
      inspection_status: "success",
      errors: [],

      total_images: 0,
      missing_alt_count: 0,
      empty_alt_count: 0,
      broken_image_count: 0,
      images: [],
    };

    try {
      // ページを取得
      const response = await page.goto(targetSite.base_url, {
        waitUntil: "domcontentloaded",
      });

      summary.page_url = page.url();

      // HTTP応答を確認
      if (response === null) {
        summary.inspection_status = "partial";
        summary.errors.push("ページのHTTPレスポンスを取得できませんでした");
      } else if (!response.ok()) {
        summary.inspection_status = "partial";
        summary.errors.push(
          `ページが正常応答ではありませんでした: HTTP ${response.status()}`,
        );
      }

      // 通常画像の読み込み完了を待つ
      await page.waitForLoadState("load");

      // 全画像を順番に表示範囲へ入れ、lazy読込を発火させる
      const imageLocators = page.locator("img");
      const imageCount = await imageLocators.count();

      for (let index = 0; index < imageCount; index++) {
        const imageLocator = imageLocators.nth(index);

        // 要素が利用者から見える状態かを、待機せず確認する
        const isVisible = await imageLocator.isVisible();

        // display:noneなどの非表示画像はスクロール対象から除外する
        if (!isVisible) {
          continue;
        }

        // 画像が画面外なら表示範囲までスクロールする
        const MAX_SCROLL_COUNT = 100;
        const SCROLL_WAIT_MS = 150;

        let previousScrollHeight = 0;

        for (let count = 0; count < MAX_SCROLL_COUNT; count++) {
          // 現在位置・画面の高さ・ページ全体の高さをブラウザ側から取得する
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

          // 最下部に到達し、lazy読込によるページ高さの変化も止まったら終了する
          if (
            reachedBottom &&
            scrollState.scrollHeight === previousScrollHeight
          ) {
            break;
          }

          previousScrollHeight = scrollState.scrollHeight;

          // 画面の約8割ずつ下へ移動し、lazy画像を順番に読込対象へ入れる
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

          // スクロール後の画像読込とDOM更新を少し待つ
          await page.waitForTimeout(SCROLL_WAIT_MS);
        }

        // 最下部付近のlazy画像が読み終わる時間を確保する
        await page.waitForTimeout(500);

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

      // ページ内に存在するすべてのimg要素を取得する。
      // evaluateAll()の中は、Playwrightを動かしているNode.js側ではなく、
      // 検査対象ページのブラウザ側で実行される。
      // 第2引数で渡した状態定数は、statusesとしてブラウザ側で受け取る。
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

      // 画像情報を集計
      summary.images = images;
      summary.total_images = images.length;

      summary.missing_alt_count = images.filter(
        (image) => image.alt_status === IMAGE_ALT_STATUS.MISSING,
      ).length;

      summary.empty_alt_count = images.filter(
        (image) => image.alt_status === IMAGE_ALT_STATUS.EMPTY,
      ).length;

      summary.broken_image_count = images.filter(
        (image) => image.load_status === IMAGE_LOAD_STATUS.BROKEN,
      ).length;
    } catch (error: unknown) {
      // 検査失敗を記録
      summary.inspection_status = "failed";

      summary.errors.push(
        error instanceof Error
          ? error.message
          : "画像情報の収集中に不明なエラーが発生しました",
      );
    } finally {
      // 検査結果をJSONへ保存
      saveJsonFile(summaryPath, summary);

      console.log(`画像情報JSONを保存しました: ${summaryPath}`);
      console.log(summary);
    }

    // 検査失敗時の本当のエラー内容をターミナルへ表示する
    console.log("inspection_status:", summary.inspection_status);
    console.log("errors:", summary.errors);

    expect(summary.inspection_status, summary.errors.join("\n")).not.toBe(
      "failed",
    );
  });
});
