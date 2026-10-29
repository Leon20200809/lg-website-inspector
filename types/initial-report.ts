import type { MetaInfo } from "./meta-summary";
import type { FormItem } from "./form-summary";
import type { HeadingItem } from "./heading-summary";
import type { ImageItem } from "./image-summary";
import type { LinkItem } from "./link-summary";
import type { PageOpenResult } from "./page-open-result";
import type { TechnologyObservation } from "./technology-summary";

/** URL以外は内部の既定値で補える初回点検の設定を表す。 */
export interface InitialInspectionConfig {
  url: string;
  site_id: string;
  display_name: string;
  purpose: string | null;
  concern: string | null;
  allowed_origins: string[];
  important_urls: string[];
  excluded_urls: string[];
  max_pages: number;
  timeout_ms: number;
  delay_ms: number;
  allow_local: boolean;
}

export type CheckStatus = "complete" | "failed" | "not_run";
export interface ObservationCheck<T> {
  status: CheckStatus;
  data: T | null;
  error: string | null;
}

export interface ViewportProfile {
  name: "pc" | "sp";
  width: number;
  height: number;
}

export interface PageObservation {
  id: string;
  requested_url: string;
  viewport: ViewportProfile;
  observed_at: string | null;
  state: "pending" | "complete" | "partial" | "failed" | "skipped";
  open: PageOpenResult | null;
  evidence_file: string;
  screenshots: { viewport: string | null; full: string | null; form: string | null };
  screenshot_error: string | null;
  checks: {
    meta: ObservationCheck<MetaInfo>;
    forms: ObservationCheck<FormItem[]>;
    headings: ObservationCheck<HeadingItem[]>;
    images: ObservationCheck<ImageItem[]>;
    links: ObservationCheck<LinkItem[]>;
    layout: ObservationCheck<{ viewport_width: number; document_width: number; horizontal_overflow: boolean }>;
    technology?: ObservationCheck<TechnologyObservation>;
  };
}

export interface ScopeDecision {
  url: string;
  selected: boolean;
  reason: string;
}

export interface InitialRunManifest {
  schema_version: 1;
  run_id: string;
  started_at: string;
  finished_at: string | null;
  status: "running" | "complete" | "partial" | "failed" | "interrupted";
  tool_version: string;
  source_commit: string | null;
  browser: { name: "chromium"; version: string | null };
  config: InitialInspectionConfig;
  scope: ScopeDecision[];
  pages: PageObservation[];
  limitations: string[];
  errors: string[];
}

export type FindingReviewStatus = "unreviewed" | "confirmed" | "deferred" | "dismissed";
export interface InitialFinding {
  id: string;
  rule: string;
  title: string;
  page_url: string;
  priority: "high" | "medium" | "low";
  priority_reason: string;
  observation: string;
  hypothesis: string;
  question: string;
  next_action: string;
  evidence_ids: string[];
  evidence_files: string[];
  screenshot: string | null;
  review_status: FindingReviewStatus;
  review_note: string | null;
}

export interface ReportPoint {
  text: string;
  evidence_ids: string[];
}

/** 観測台帳と併存する編集用レポートを表し、本人の確認までレビュー待ちを維持する。 */
export interface InitialReportContent {
  schema_version: 1;
  run_id: string;
  display_name: string;
  summary: string;
  strengths: ReportPoint[];
  findings: InitialFinding[];
  questions: string[];
  owner_review: "pending" | "completed";
  reviewer_note: string | null;
}
