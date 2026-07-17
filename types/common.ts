/**
 * 各検査JSONで共通して使用する型を定義する。
 */

// 検査処理そのものの完了状態
export type InspectionStatus = "success" | "partial" | "failed";

// 各検査JSONの共通情報
export interface BaseInspectionSummary {
  site_id: string;
  site_name: string;
  base_url: string;
  page_url: string;
  inspected_at: string;
  inspection_status: InspectionStatus;
  errors: string[];
}
