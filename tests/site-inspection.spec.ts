import { test } from "@playwright/test";

import { openPageTarget } from "../helpers/page-crawler";
import { createRootPageTarget } from "../helpers/page-targets";
import { getActiveTargetSites } from "../helpers/target";

const activeTargetSites = getActiveTargetSites();

test.describe("サイト総合検査", () => {
  /**
   * 通常のテスト実行では外部サイトへ接続しない。
   *
   * 将来、正式な実行コマンド側から
   * RUN_LIVE_TESTS=1を設定する。
   */
  test.skip(
    process.env.RUN_LIVE_TESTS !== "1",
    "RUN_LIVE_TESTS=1のときだけ本物のサイトを検査する",
  );

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
       *
       * 次の作業でlink Inspectorを接続する。
       */

      /**
       * STEP 4
       * 内部ページの巡回予定表を作る。
       *
       * 次の作業でPageTarget[]を生成する。
       */

      /**
       * STEP 5
       * PageTarget[]を順番に開く。
       */

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
