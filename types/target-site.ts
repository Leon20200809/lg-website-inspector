/**
 * 検査対象サイトの設定情報を定義する。
 */

export type TargetSiteMode = "own" | "external" | "demo";

export interface TargetSite {
  id: string;
  name: string;
  base_url: string;
  mode: TargetSiteMode;
  is_active: boolean;
  expected_title_keywords: string[];
  allow_form_submit: boolean;
}
