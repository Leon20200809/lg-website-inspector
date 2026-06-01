/**
 * WEBサイトの表示状態をスクリーンショットとして保存するテスト
 * npm run test -- tests/screenshot.spec.ts
 *
 * 目的：
 * - PC表示の証拠画像を残す
 * - スマホ表示の証拠画像を残す
 * - 将来的なPDFレポートに貼れる素材を作る
 *
 * 保存先：
 * reports/{site_id}/images/
 */

import fs from "fs";
import path from "path";
import { test } from "@playwright/test";
import { getActiveTargetSites } from "../helpers/target";

// PC表示の撮影サイズ
const PC_VIEWPORT = {
  width: 1280,
  height: 900,
};

// スマホ表示の撮影サイズ
const SP_VIEWPORT = {
  width: 390,
  height: 844,
};

// レポート保存先の基準ディレクトリ
const REPORTS_DIR = "reports";

// レポート内の画像保存フォルダ名
const IMAGES_DIR = "images";

const activeSites = getActiveTargetSites();

activeSites.forEach((target_site) => {
  test(`${target_site.name} のPC表示スクリーンショットを保存する`, async ({ page }) => {
    const imageDir = path.join(REPORTS_DIR, target_site.id, IMAGES_DIR);
    const imagePath = path.join(imageDir, "pc-home.png");

    fs.mkdirSync(imageDir, {
      recursive: true,
    });

    await page.setViewportSize(PC_VIEWPORT);

    await page.goto(target_site.base_url);

    await page.screenshot({
      path: imagePath,
      fullPage: true,
    });
  });

  test(`${target_site.name} のスマホ表示スクリーンショットを保存する`, async ({ page }) => {
    const imageDir = path.join(REPORTS_DIR, target_site.id, IMAGES_DIR);
    const imagePath = path.join(imageDir, "sp-home.png");

    fs.mkdirSync(imageDir, {
      recursive: true,
    });

    await page.setViewportSize(SP_VIEWPORT);

    await page.goto(target_site.base_url);

    await page.screenshot({
      path: imagePath,
      fullPage: true,
    });
  });
});