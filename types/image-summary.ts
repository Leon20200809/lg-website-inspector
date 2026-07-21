/**
 * 画像・alt属性・読み込み状態の型を定義する。
 */

import type { BaseInspectionSummary } from "./common";

// alt属性の状態を定数として管理する
export const IMAGE_ALT_STATUS = {
  PRESENT: "present",
  EMPTY: "empty",
  MISSING: "missing",
} as const;

// alt属性の状態型を定数から生成する
export type ImageAltStatus =
  (typeof IMAGE_ALT_STATUS)[keyof typeof IMAGE_ALT_STATUS];

// 画像の読み込み状態を定数として管理する
export const IMAGE_LOAD_STATUS = {
  LOADED: "loaded",
  BROKEN: "broken",
  NOT_LOADED: "not_loaded",
  UNKNOWN: "unknown",
} as const;

// 画像の読み込み状態型を定数から生成する
export type ImageLoadStatus =
  (typeof IMAGE_LOAD_STATUS)[keyof typeof IMAGE_LOAD_STATUS];

// ページ内に存在する1つの画像
export interface ImageItem {
  // DOM上の出現順を残す
  order: number;

  // HTMLのsrc属性をそのまま残す
  src: string | null;

  // ブラウザが実際に選択した画像URLを残す
  current_src: string;

  // alt属性なしと空文字を区別する
  alt: string | null;

  // alt属性の状態を分類する
  alt_status: ImageAltStatus;

  // lazyなどの読み込み指定を確認する
  loading: string | null;

  // ブラウザの読み込み処理が終了したか残す
  complete: boolean;

  // 正常・画像切れ・未読込などを区別する
  load_status: ImageLoadStatus;

  // 正常に画像サイズを取得できたか残す
  loaded: boolean;

  // 読み込まれた画像本来の横幅を残す
  natural_width: number;

  // 読み込まれた画像本来の高さを残す
  natural_height: number;
}

// ページ全体の画像情報
export interface ImageSummary extends BaseInspectionSummary {
  // ページ内のimg要素数
  total_images: number;

  // alt属性自体が存在しない画像数
  missing_alt_count: number;

  // alt属性が空文字の画像数
  empty_alt_count: number;

  // 読み込み失敗と判断できた画像数
  broken_image_count: number;

  // 各画像の根拠データ
  images: ImageItem[];
}
