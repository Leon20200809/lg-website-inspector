/**
 * レポート関連ファイルの保存先・ファイル名を管理する定数群。
 *
 * tests/*.spec.ts や scripts/*.ts で同じ文字列を何度も書かないように、
 * reports 配下のディレクトリ名や summary JSON のファイル名をここに集約する。
 */

import path from "path";

const REPORTS_DIR = "reports";
const DATA_DIR = "data";
const IMAGES_DIR = "images";
const FORM_DIR = "form";

export const SUMMARY_FILES = {
  smoke: "smoke-summary.json",
  navigation: "navigation-summary.json",

  meta: "meta-summary.json",
  heading: "heading-summary.json",
  link: "link-summary.json",
  image: "image-summary.json",
  form: "form-summary.json",
} as const;

export function getReportDir(site_id: string): string {
  return path.join(REPORTS_DIR, site_id);
}

export function getReportDataDir(site_id: string): string {
  return path.join(getReportDir(site_id), DATA_DIR);
}

export function getReportImagesDir(site_id: string): string {
  return path.join(getReportDir(site_id), IMAGES_DIR);
}

export function getSummaryJsonPath(site_id: string, file_name: string): string {
  return path.join(getReportDataDir(site_id), file_name);
}
