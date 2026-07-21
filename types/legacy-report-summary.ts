/**
 * 新しい検査JSONへ移行するまで、既存レポート生成で使用する型を定義する。
 */

interface LegacyBaseSummary {
  site_id: string;
  site_name: string;
  base_url: string;
}

export interface LegacySmokeSummary extends LegacyBaseSummary {
  page_opened: boolean;
  title_checked: boolean;
  title_text: string;
  title_matched_keywords: boolean;
  h1_exists: boolean;
  h1_text: string;
}

export interface LegacyNavigationSummary extends LegacyBaseSummary {
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
