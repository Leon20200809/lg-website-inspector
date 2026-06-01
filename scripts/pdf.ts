/**
 * report-source.md を HTML に変換し、PDFとして保存する
 *
 * 目的：
 * - 生成済みの Markdown レポートを PDF に変換する
 * - レポート画像（./images/pc-home.png など）をそのまま表示できるようにする
 *
 * 入力：
 * reports/{site_id}/report-source.md
 *
 * 出力：
 * reports/{site_id}/report-source.html
 * reports/{site_id}/report.pdf
 */

import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";
import { chromium } from "@playwright/test";
import MarkdownIt from "markdown-it";
import { getActiveTargetSites } from "../helpers/target";

const REPORTS_DIR = "reports";

const activeSites = getActiveTargetSites();

const md = new MarkdownIt({
  html: true,
  linkify: true,
  breaks: true,
});

/**
 * HTMLドキュメント全体を作る
 */
const buildHtmlDocument = (title: string, markdown: string): string => {
  const bodyHtml = md.render(markdown);

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    body {
      font-family: "Yu Gothic", "Hiragino Sans", sans-serif;
      line-height: 1.8;
      color: #222;
      margin: 40px;
      font-size: 14px;
    }

    h1, h2, h3 {
      line-height: 1.4;
      margin-top: 32px;
      margin-bottom: 16px;
    }

    h1 {
      font-size: 28px;
      border-bottom: 2px solid #333;
      padding-bottom: 8px;
    }

    h2 {
      font-size: 22px;
      border-bottom: 1px solid #ccc;
      padding-bottom: 6px;
    }

    h3 {
      font-size: 18px;
    }

    p, ul, ol {
      margin-block: 12px;
    }

    ul, ol {
      padding-inline-start: 24px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-block: 16px;
      font-size: 13px;
    }

    th, td {
      border: 1px solid #ccc;
      padding-block: 8px;
      padding-inline: 10px;
      text-align: left;
      vertical-align: top;
    }

    th {
      background-color: #f5f5f5;
    }

    img {
      max-width: 100%;
      height: auto;
      display: block;
      margin-block: 16px;
      border: 1px solid #ddd;
    }

    code {
      background-color: #f5f5f5;
      padding-block: 2px;
      padding-inline: 6px;
      border-radius: 4px;
      font-size: 12px;
    }

    pre code {
      display: block;
      padding: 12px;
      overflow-x: auto;
    }

    a {
      color: #0b57d0;
      text-decoration: underline;
      word-break: break-all;
    }
  </style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
};

/**
 * 1サイト分の Markdown を HTML / PDF に変換する
 */
const generatePdfForSite = async (
  siteId: string,
  siteName: string,
): Promise<void> => {
  const reportDir = path.join(REPORTS_DIR, siteId);
  const markdownPath = path.join(reportDir, "report-source.md");
  const htmlPath = path.join(reportDir, "report-source.html");
  const pdfPath = path.join(reportDir, "report.pdf");

  if (!fs.existsSync(markdownPath)) {
    console.log(`Markdownが見つかりません: ${markdownPath}`);
    return;
  }

  const markdown = fs.readFileSync(markdownPath, "utf-8");
  const html = buildHtmlDocument(`${siteName} レポート`, markdown);

  fs.writeFileSync(htmlPath, html, "utf-8");
  console.log(`HTMLを生成しました: ${htmlPath}`);

  const browser = await chromium.launch();

  const page = await browser.newPage();

  // file:// URL に変換して開く
  await page.goto(pathToFileURL(path.resolve(htmlPath)).href, {
    waitUntil: "load",
  });

  await page.pdf({
    path: pdfPath,
    format: "A4",
    printBackground: true,
    margin: {
      top: "16mm",
      right: "14mm",
      bottom: "16mm",
      left: "14mm",
    },
  });

  await browser.close();

  console.log(`PDFを生成しました: ${pdfPath}`);
};

/**
 * active な対象サイト分だけ PDF を生成する
 */
const main = async (): Promise<void> => {
  for (const targetSite of activeSites) {
    await generatePdfForSite(targetSite.id, targetSite.name);
  }
};

main().catch((error) => {
  console.error("PDF生成中にエラーが発生しました");
  console.error(error);
  process.exit(1);
});