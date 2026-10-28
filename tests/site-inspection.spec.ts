import { test } from "@playwright/test";

import { getActiveTargetSites } from "../helpers/target";
import { openPageTarget } from "../helpers/page-crawler";

import {
  getPageSummaryJsonPath,
  getSummaryJsonPath,
  SUMMARY_FILES,
} from "../helpers/report-paths";

import { saveJsonFile } from "../helpers/json-file";
import { getJapanIsoString } from "../helpers/date";

import type { PageTargetSummary } from "../types/page-target-summary";

import {
  createRootPageTarget,
  createInitialPageTargets,
} from "../helpers/page-targets";

import {
  collectExistingIdSet,
  collectRawLinks,
  createLinkItems,
  applyLinkSummary,
} from "../inspectors/link-inspector";

import type { LinkItem, LinkSummary } from "../types/link-summary";

import { collectMetaInfo } from "../inspectors/meta-inspector";

import type { MetaSummary } from "../types/meta-summary";

import {
  applyFormSummary,
  collectFormItems,
} from "../inspectors/form-inspector";

import type { FormSummary } from "../types/form-summary";

import {
  applyImageSummary,
  collectImageItems,
  scrollThroughPage,
  waitForVisibleImageLoadResults,
} from "../inspectors/image-inspector";

import type { ImageItem, ImageSummary } from "../types/image-summary";

import {
  applyHeadingSummary,
  collectHeadingItems,
} from "../inspectors/heading-inspector";

import type { HeadingSummary } from "../types/heading-summary";

const activeTargetSites = getActiveTargetSites();

test.describe("サイト総合検査", () => {
  /**
   * 将来、正式な安全装置を考える。
   */
  test.setTimeout(600_000);

  for (const targetSite of activeTargetSites) {
    test(`${targetSite.name}の事実を収集する`, async ({ page }) => {
      console.log(`サイト総合検査を開始します: ${targetSite.name}`);

      /**
       * STEP 1
       * 検査対象サイトの起点ページを作る。
       */
      const rootTarget = createRootPageTarget(targetSite.base_url);

      /**
       * STEP 2
       * 起点ページを1回だけ開く。
       */
      const rootOpenResult = await openPageTarget(page, rootTarget);

      console.log(
        "起点ページの到達結果:",
        JSON.stringify(rootOpenResult, null, 2),
      );

      /**
       * 起点ページを開けなければ、
       * 内部リンクも各Inspectorも実行できない。
       */
      if (!rootOpenResult.opened) {
        throw new Error(
          [
            "起点ページを開けなかったため、",
            "サイト総合検査を開始できませんでした。",
            rootOpenResult.error_message ?? "原因を取得できませんでした。",
          ].join(""),
        );
      }

      console.log(`起点ページを開けました: ${rootOpenResult.final_url}`);

      /**
       * STEP 3
       * 起点ページからリンク情報を収集する。
       */
      const rawLinks = await collectRawLinks(page);

      const existingIdSet = await collectExistingIdSet(page);

      const links = createLinkItems(rawLinks, page.url(), existingIdSet);

      console.log(`起点ページから${links.length}件のリンクを収集しました`);

      /**
       * STEP 4
       * 起点ページと内部リンクから巡回対象ページを作る。
       */
      const pageTargets = createInitialPageTargets(page.url(), links);

      console.log(
        `${links.length}件のリンクから${pageTargets.length}ページの巡回対象を作成しました`,
      );

      console.log(
        "巡回対象:",
        pageTargets.map((target) => target.normalized_url),
      );

      const pageTargetSummary: PageTargetSummary = {
        site_id: targetSite.id,
        site_name: targetSite.name,
        base_url: targetSite.base_url,
        generated_at: getJapanIsoString(),
        total_pages: pageTargets.length,
        pages: pageTargets,
      };

      const pageTargetsPath = getSummaryJsonPath(
        targetSite.id,
        SUMMARY_FILES.pageTargets,
      );

      saveJsonFile(pageTargetsPath, pageTargetSummary);

      console.log(`ページ巡回予定JSONを保存しました: ${pageTargetsPath}`);

      /**
       * STEP 5
       * 起点ページ以外の巡回対象を順番に開く。
       *
       * 起点ページはSTEP 2ですでに開いているため、
       * pageTargetsの2件目以降だけを巡回する。
       */
      const pageOpenResults = [];

      for (const [index, pageTarget] of pageTargets.entries()) {
        /**
         * 起点ページはSTEP 2ですでに開いている。
         * 2ページ目以降だけ実際に移動する。
         */
        const openResult =
          index === 0 ? rootOpenResult : await openPageTarget(page, pageTarget);

        pageOpenResults.push(openResult);

        console.log(
          [
            `[${openResult.open_status}]`,
            `HTTP ${openResult.http_status ?? "-"}`,
            openResult.requested_url,
          ].join(" "),
        );

        /**
         * ページ自体を開けなかった場合は、
         * DOMを調査できないため次ページへ進む。
         */
        if (!openResult.opened) {
          continue;
        }

        /**
         * STEP 6-1
         * 現在表示しているページからmeta情報を取得する。
         */
        const metaInfo = await collectMetaInfo(page);

        const metaSummary: MetaSummary = {
          site_id: targetSite.id,
          site_name: targetSite.name,
          base_url: targetSite.base_url,

          page_url: openResult.final_url ?? pageTarget.discovered_url,

          inspected_at: getJapanIsoString(),

          inspection_status: openResult.open_status,

          errors:
            openResult.error_message !== null ? [openResult.error_message] : [],

          ...metaInfo,
        };

        const metaPath = getPageSummaryJsonPath(
          targetSite.id,
          pageTarget.normalized_url,
          SUMMARY_FILES.meta,
        );

        saveJsonFile(metaPath, metaSummary);

        console.log(`meta JSONを保存しました: ${metaPath}`);

        /**
         * STEP 6-2
         * 現在表示しているページからフォーム構造を取得する。
         */
        await page.waitForLoadState("load");

        const formSummary: FormSummary = {
          site_id: targetSite.id,
          site_name: targetSite.name,
          base_url: targetSite.base_url,

          page_url: openResult.final_url ?? pageTarget.discovered_url,

          inspected_at: getJapanIsoString(),

          inspection_status: openResult.open_status,

          errors:
            openResult.error_message !== null ? [openResult.error_message] : [],

          form_found: false,
          total_forms: 0,
          total_fields: 0,
          total_required_fields: 0,
          total_missing_labels: 0,

          form_submit_tested: false,

          forms: [],
        };

        const forms = await collectFormItems(page);

        applyFormSummary(formSummary, forms);

        const formPath = getPageSummaryJsonPath(
          targetSite.id,
          pageTarget.normalized_url,
          SUMMARY_FILES.form,
        );

        saveJsonFile(formPath, formSummary);

        console.log(`form JSONを保存しました: ${formPath}`);

        /**
         * STEP 6-3
         * 現在表示しているページのリンク情報を取得する。
         *
         * 起点ページはSTEP 3ですでに取得済みなので再利用する。
         */
        let pageLinks: LinkItem[];

        if (index === 0) {
          pageLinks = links;
        } else {
          const rawPageLinks = await collectRawLinks(page);

          const existingIdSet = await collectExistingIdSet(page);

          pageLinks = createLinkItems(rawPageLinks, page.url(), existingIdSet);
        }

        const linkSummary: LinkSummary = {
          site_id: targetSite.id,
          site_name: targetSite.name,
          base_url: targetSite.base_url,

          page_url: openResult.final_url ?? pageTarget.discovered_url,

          inspected_at: getJapanIsoString(),

          inspection_status: openResult.open_status,

          errors:
            openResult.error_message !== null ? [openResult.error_message] : [],

          total_links: 0,

          anchor_links: 0,
          empty_href_links: 0,
          placeholder_links: 0,
          tel_links: 0,
          mail_links: 0,
          pdf_links: 0,
          internal_links: 0,
          external_links: 0,
          other_links: 0,
          empty_text_links: 0,

          http_check_status: "not_run",

          checked_links: 0,
          successful_links: 0,
          redirect_links: 0,
          warning_links: 0,
          broken_links: 0,
          skipped_links: 0,

          missing_anchor_links: 0,

          links: [],
        };

        applyLinkSummary(linkSummary, pageLinks);

        const linkPath = getPageSummaryJsonPath(
          targetSite.id,
          pageTarget.normalized_url,
          SUMMARY_FILES.link,
        );

        saveJsonFile(linkPath, linkSummary);

        console.log(`link JSONを保存しました: ${linkPath}`);

        /**
         * STEP 6-4
         * 現在表示しているページの見出し構造を取得する。
         */
        const headingSummary: HeadingSummary = {
          site_id: targetSite.id,
          site_name: targetSite.name,
          base_url: targetSite.base_url,

          page_url: openResult.final_url ?? pageTarget.discovered_url,

          inspected_at: getJapanIsoString(),

          inspection_status: openResult.open_status,

          errors:
            openResult.error_message !== null ? [openResult.error_message] : [],

          total_headings: 0,
          h1_count: 0,
          h2_count: 0,
          h3_count: 0,
          empty_heading_count: 0,

          headings: [],
        };

        const headings = await collectHeadingItems(page);

        applyHeadingSummary(headingSummary, headings);

        const headingPath = getPageSummaryJsonPath(
          targetSite.id,
          pageTarget.normalized_url,
          SUMMARY_FILES.heading,
        );

        saveJsonFile(headingPath, headingSummary);

        console.log(`heading JSONを保存しました: ${headingPath}`);

        /**
         * STEP 6-5
         * 現在表示しているページの画像情報を取得する。
         */

        // lazy画像を読み込ませるため、ページ最下部まで段階的にスクロールする
        await scrollThroughPage(page);

        // 表示画像の読み込み成功・失敗が確定するまで待つ
        await waitForVisibleImageLoadResults(page);

        const imageSummary: ImageSummary = {
          site_id: targetSite.id,
          site_name: targetSite.name,
          base_url: targetSite.base_url,

          page_url: openResult.final_url ?? pageTarget.discovered_url,

          inspected_at: getJapanIsoString(),

          inspection_status: openResult.open_status,

          errors:
            openResult.error_message !== null ? [openResult.error_message] : [],

          total_images: 0,
          missing_alt_count: 0,
          empty_alt_count: 0,
          broken_image_count: 0,

          images: [],
        };

        const images: ImageItem[] = await collectImageItems(page);

        applyImageSummary(imageSummary, images);

        const imagePath = getPageSummaryJsonPath(
          targetSite.id,
          pageTarget.normalized_url,
          SUMMARY_FILES.image,
        );

        saveJsonFile(imagePath, imageSummary);

        console.log(`image JSONを保存しました: ${imagePath}`);
      }

      console.log(`${pageOpenResults.length}ページの巡回が完了しました`);

      /**
       * STEP 6
       * 表示中の各ページへInspectorを編成する。
       *
       * - meta
       * - heading
       * - link
       * - form
       * - image
       */

      /**
       * STEP 7
       * ページ別JSONとサイト全体JSONを保存する。
       */
    });
  }
});
