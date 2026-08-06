import path from "path";

import { expect, test } from "@playwright/test";

import {
  getPageReportDir,
  getPageSummaryJsonPath,
  SUMMARY_FILES,
} from "../helpers/report-paths";

test.describe("getPageReportDir", () => {
  test("トップページと/homeページの保存先は衝突しない", () => {
    const rootDir = getPageReportDir(
      "example",
      "https://example.com/",
    );

    const homeDir = getPageReportDir(
      "example",
      "https://example.com/home/",
    );

    expect(rootDir).not.toBe(homeDir);

    expect(path.basename(rootDir)).toMatch(
      /^_root--[0-9a-f]{8}$/,
    );

    expect(path.basename(homeDir)).toMatch(
      /^home--[0-9a-f]{8}$/,
    );
  });

  test("/entryと/entry/は同じ保存先になる", () => {
    const withoutSlash = getPageReportDir(
      "example",
      "https://example.com/entry",
    );

    const withSlash = getPageReportDir(
      "example",
      "https://example.com/entry/",
    );

    expect(withoutSlash).toBe(withSlash);
  });

  test("階層構造を保存先へ反映する", () => {
    const reportDir = getPageReportDir(
      "example",
      "https://example.com/about/message/",
    );

    expect(path.dirname(reportDir)).toBe(
      path.join(
        "reports",
        "example",
        "pages",
        "about",
      ),
    );

    expect(path.basename(reportDir)).toMatch(
      /^message--[0-9a-f]{8}$/,
    );
  });

  test("hashだけが異なるURLは同じ保存先になる", () => {
    const companyDir = getPageReportDir(
      "example",
      "https://example.com/about/#company",
    );

    const accessDir = getPageReportDir(
      "example",
      "https://example.com/about/#access",
    );

    expect(companyDir).toBe(accessDir);
  });

  test("クエリ文字列が異なるURLは別の保存先になる", () => {
    const firstPageDir = getPageReportDir(
      "example",
      "https://example.com/news/?page=1",
    );

    const secondPageDir = getPageReportDir(
      "example",
      "https://example.com/news/?page=2",
    );

    expect(firstPageDir).not.toBe(secondPageDir);
  });
});

test.describe("getPageSummaryJsonPath", () => {
  test("ページ別ディレクトリ内にJSON保存先を作る", () => {
    const reportDir = getPageReportDir(
      "example",
      "https://example.com/entry/",
    );

    const summaryPath = getPageSummaryJsonPath(
      "example",
      "https://example.com/entry/",
      SUMMARY_FILES.form,
    );

    expect(summaryPath).toBe(
      path.join(reportDir, "form-summary.json"),
    );
  });
});
