/**
 * 検査日時・対象・実行条件・検査成否の型を定義する。
 */

import type { InspectionStatus } from "./common";
import type { TargetSiteMode } from "./target-site";

// 今回どこまで検査したか
export type InspectionScope = "top_page_only" | "selected_pages" | "full_site";

// 検査全体の実行情報
export interface InspectionMeta {
  site_id: string;
  site_name: string;
  base_url: string;
  inspected_at: string;
  inspector_version: string;
  inspection_scope: InspectionScope;
  mode: TargetSiteMode;
  inspection_status: InspectionStatus;
  inspected_pages: string[];
  errors: string[];
}
