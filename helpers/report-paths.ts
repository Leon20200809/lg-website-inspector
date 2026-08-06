/**
 * レポート関連ファイルの保存先・ファイル名を管理する。
 */

import { createHash } from "node:crypto";
import path from "path";

import { normalizePageUrl } from "./page-targets";

const REPORTS_DIR = "reports";
const DATA_DIR = "data";
const IMAGES_DIR = "images";
const PAGES_DIR = "pages";
const ROOT_PAGE_DIR = "_root";

export const SUMMARY_FILES = {
  pageTargets: "page-targets.json",

  meta: "meta-summary.json",
  heading: "heading-summary.json",
  link: "link-summary.json",
  image: "image-summary.json",
  form: "form-summary.json",
} as const;

/**
 * URLのパス部分を安全なディレクトリ名へ変換する。
 */
function sanitizePagePathSegment(segment: string): string {
  const sanitized = segment
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_")
    .replace(/[. ]+$/g, "");

  const safeSegment = sanitized === "" ? "_" : sanitized;

  // Windowsで使用できない予約名との衝突を避ける
  const windowsReservedName = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i;

  return windowsReservedName.test(safeSegment)
    ? `_${safeSegment}`
    : safeSegment;
}

/**
 * 正規化URLから保存先識別用の短い指紋を作る。
 */
function createPageFingerprint(pageUrl: string): string {
  return createHash("sha256").update(pageUrl).digest("hex").slice(0, 8);
}

/**
 * ページURLをレポート保存用のパス要素へ変換する。
 */
function getPagePathSegments(pageUrl: string): string[] {
  const normalizedUrl = normalizePageUrl(pageUrl);
  const url = new URL(normalizedUrl);

  const pathnameSegments = url.pathname
    .split("/")
    .filter((segment) => segment !== "")
    .map(sanitizePagePathSegment);

  const pageSegments =
    pathnameSegments.length > 0 ? pathnameSegments : [ROOT_PAGE_DIR];

  const fingerprint = createPageFingerprint(normalizedUrl);
  const lastIndex = pageSegments.length - 1;

  pageSegments[lastIndex] = `${pageSegments[lastIndex]}--${fingerprint}`;

  return pageSegments;
}

export function getReportDir(siteId: string): string {
  return path.join(REPORTS_DIR, siteId);
}

export function getReportDataDir(siteId: string): string {
  return path.join(getReportDir(siteId), DATA_DIR);
}

export function getReportImagesDir(siteId: string): string {
  return path.join(getReportDir(siteId), IMAGES_DIR);
}

export function getSummaryJsonPath(siteId: string, fileName: string): string {
  return path.join(getReportDataDir(siteId), fileName);
}

/**
 * 1ページ分の検査結果を保存するディレクトリを返す。
 */
export function getPageReportDir(siteId: string, pageUrl: string): string {
  return path.join(
    getReportDir(siteId),
    PAGES_DIR,
    ...getPagePathSegments(pageUrl),
  );
}

/**
 * 1ページ分の検査JSON保存先を返す。
 */
export function getPageSummaryJsonPath(
  siteId: string,
  pageUrl: string,
  fileName: string,
): string {
  return path.join(getPageReportDir(siteId, pageUrl), fileName);
}
