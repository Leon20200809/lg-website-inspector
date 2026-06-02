// 動作モードの定義
export type TargetSiteMode = "own" | "external" | "demo";

// サイト情報の型定義
export interface TargetSite {
  id: string;
  name: string;
  base_url: string;
  mode: TargetSiteMode;
  is_active: boolean;
  expected_title_keywords: string[];
  allow_form_submit: boolean;
}

export interface BaseSummary {
  site_id: string;
  site_name: string;
  base_url: string;
}

export interface SmokeSummary extends BaseSummary {
  page_opened: boolean;
  title_checked: boolean;
  title_text: string;
  title_matched_keywords: boolean;
  h1_exists: boolean;
  h1_text: string;
}

export interface NavigationSummary extends BaseSummary {
  total_links: number;
  anchor_links: number;
  empty_href_links: number;
  placeholder_links: number;
  tel_links: number;
  mail_links: number;
  pdf_links: number;
  internal_links: number;
  external_links: number;
  suspicious_links: number;
}
