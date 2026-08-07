import { test } from "@playwright/test";

import { getActiveTargetSites } from "../helpers/target";
import { openPageTarget } from "../helpers/page-crawler";
import {
  createRootPageTarget,
  createInitialPageTargets,
} from "../helpers/page-targets";

import {
  collectExistingIdSet,
  collectRawLinks,
  createLinkItems,
} from "../inspectors/link-inspector";

import { collectMetaInfo } from "../inspectors/meta-inspector";

import { getPageSummaryJsonPath, SUMMARY_FILES } from "../helpers/report-paths";

import { saveJsonFile } from "../helpers/json-file";
import { getJapanIsoString } from "../helpers/date";

import type { MetaSummary } from "../types/meta-summary";

const activeTargetSites = getActiveTargetSites();

test.describe("サイト総合検査", () => {
  /**
   * 将来、正式な安全装置を考える。
   */

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

      console.log(`起点ページを開けました: ${rootOpenResult.final_url}`);
    });
  }
});
