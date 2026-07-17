/**
 * 画像・alt属性・読み込み状態の型を定義する。
 */

import type { BaseInspectionSummary } from "./common";

// alt属性の状態
export type ImageAltStatus = "present" | "empty" | "missing";

// ページ内に存在する1つの画像
export interface ImageItem {
  order: number;
  src: string | null;
  current_src: string;
  alt: string | null;
  alt_status: ImageAltStatus;
  loaded: boolean;
  natural_width: number;
  natural_height: number;
}

// ページ全体の画像情報
export interface ImageSummary extends BaseInspectionSummary {
  total_images: number;
  missing_alt_count: number;
  empty_alt_count: number;
  broken_image_count: number;
  images: ImageItem[];
}
