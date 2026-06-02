/**
 * WEBサイトのリンク・導線情報を確認するテスト
 * npm run test -- tests/navigation.spec.ts
 *
 * 目的：
 * - トップページ内のリンク数を確認する
 * - 各リンクの href を取得する
 * - 空リンクや # だけのリンクを把握する
 * - ページ内アンカーの有無を確認する
 * - 将来的なレポート材料を集める
 *
 * 注意：
 * このMVPでは、リンクが少ない・リンクがないこと自体は失敗扱いにしない。
 * まずは「何があるか」を観測する。
 */

import { test, expect } from "@playwright/test";
import fs from "fs";
import { getActiveTargetSites } from "../helpers/target";
import { getReportDataDir, getSummaryJsonPath, SUMMARY_FILES,} from "../helpers/report-paths";

const activeSites = getActiveTargetSites();

activeSites.forEach((target_site) => {
  test(`${target_site.name} のトップページ内リンクを確認する`, async ({
    page,
  }) => {
    await page.goto(target_site.base_url);

    const links = page.locator("a");

    const linkCount = await links.count();

    const summary = {
      site_id: target_site.id,
      site_name: target_site.name,
      base_url: target_site.base_url,
      total_links: linkCount,
      anchor_links: 0,
      empty_href_links: 0,
      placeholder_links: 0,
      tel_links: 0,
      mail_links: 0,
      pdf_links: 0,
      internal_links: 0,
      external_links: 0,
      suspicious_links: 0,
    };

    const dataDir = getReportDataDir(target_site.id);
    

    fs.mkdirSync(dataDir, {
      recursive: true,
    });

    console.log(`${target_site.name} のリンク数: ${linkCount}`);

    // リンクが0件でも、現時点では失敗扱いにしない
    if (linkCount === 0) {
      console.log(`${target_site.name} にはリンクがありませんでした`);
      return;
    }

    for (let i = 0; i < linkCount; i++) {
      const link = links.nth(i);

      const text = await link.textContent();
      const href = await link.getAttribute("href");

      console.log("-----");
      console.log(`リンク番号: ${i + 1}`);
      console.log(`テキスト: ${text?.trim() || "(テキストなし)"}`);
      console.log(`href: ${href || "(hrefなし)"}`);

      if (!href) {
        summary.empty_href_links++;
        console.log("判定: hrefなし");
        continue;
      }

      if (href === "#") {
        summary.placeholder_links++;
        console.log("判定: #だけのリンク");
        continue;
      }

      if (href.startsWith("#")) {
        summary.anchor_links++;

        const targetId = href.replace("#", "");
        const anchorTarget = page.locator(`#${targetId}`);
        const anchorCount = await anchorTarget.count();

        console.log(`判定: ページ内アンカー`);
        console.log(`対象ID: ${targetId}`);
        console.log(`対象IDの存在数: ${anchorCount}`);

        continue;
      }

      if (href.startsWith("tel:")) {
        summary.tel_links++;
        console.log("判定: 電話リンク");
        continue;
      }

      if (href.startsWith("mailto:")) {
        summary.mail_links++;
        console.log("判定: メールリンク");
        continue;
      }

      if (href.toLowerCase().includes(".pdf")) {
        summary.pdf_links++;
        console.log("判定: PDFリンク");
        continue;
      }

      if (href.startsWith("/")) {
        summary.internal_links++;
        console.log("判定: 内部リンク");
        continue;
      }

      if (href.startsWith(target_site.base_url)) {
        summary.internal_links++;
        console.log("判定: 内部リンク");
        continue;
      }

      if (href.startsWith("http")) {
        summary.external_links++;
        console.log("判定: 外部リンク");

        // URL文字列に不自然な連結がないか最低限確認する
        // 例: https://example.comwp-content/... のような形式
        if (
          href.includes(`${new URL(target_site.base_url).origin}wp-content`)
        ) {
          summary.suspicious_links++;
          console.log("判定: 要確認リンク候補");
        }

        continue;
      }

      // それ以外は、今は href が存在する事実だけ記録する
      console.log("判定: その他リンク");
    }

    // ページ自体が開けていることだけは最低限確認する
    await expect(page).toHaveURL(/.+/);

    const summaryPath = getSummaryJsonPath(target_site.id, SUMMARY_FILES.navigation);

    if (linkCount === 0) {
      console.log(`${target_site.name} にはリンクがありませんでした`);
      console.log("===== リンク集計結果 =====");
      console.log(summary);
      

      fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), "utf-8");

      console.log(`ナビゲーション集計JSONを保存しました: ${summaryPath}`);

      return;
    }

    console.log("===== リンク集計結果 =====");
    console.log(summary);

    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), "utf-8");

    console.log(`ナビゲーション集計JSONを保存しました: ${summaryPath}`);
  });
});
