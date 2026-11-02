/** 元の観測と JSON Pointer で対応付ける、推論を含まない事実レコード。 */
export interface LlmFact {
  fact_id: string;
  page_id: string;
  page_url: string;
  viewport: { name: "pc" | "sp"; width: number; height: number } | null;
  observed_at: string | null;
  observation_state: string;
  kind: string;
  source: { file: "manifest.json" | "supplement.json"; pointer: string; observation_file: string | null };
  value: unknown;
}

/** 公開アセットを別時点で読み取った静的レビューの記録。 */
export interface LlmSupplement {
  schema_version: 1;
  observations: Array<{
    id: string;
    observed_at: string;
    method: "public_asset_static_review";
    source_url: string;
    source_sha256: string;
    facts: Array<{ key: string; value: unknown; evidence_excerpt?: string }>;
    limitations: string[];
  }>;
}

/** 他の LLM に共通して渡す、同一実行から作成した観測事実。 */
export interface LlmFactsDocument {
  schema_version: 1;
  case_id: string;
  source: {
    manifest_sha256: string;
    tool_version: string;
    source_commit: string | null;
    started_at: string;
    finished_at: string | null;
    status: string;
    browser: { name: string; version: string | null };
  };
  declared_context: {
    url: string;
    purpose: string | null;
    concern: string | null;
    note: string;
  };
  scope: unknown[];
  limitations: string[];
  errors: string[];
  interpretation_notes: string[];
  facts: LlmFact[];
}

/** 実験入力のファイルを SHA-256 で固定する記録。 */
export interface LlmCaseManifest {
  schema_version: 1;
  case_id: string;
  case_sha256: string;
  prompt_version: "initial-review-v1";
  files: Record<string, string>;
}

export interface LlmClaim {
  statement: string;
  fact_ids: string[];
}

export interface LlmOpportunity {
  category: string;
  page_url: string;
  title: string;
  priority: "high" | "medium" | "low";
  priority_reason: string;
  observation: string;
  hypothesis: string;
  question: string;
  next_action: string;
  fact_ids: string[];
}

/** 機械比較のために各 LLM が返す共通 JSON 形式。 */
export interface LlmReviewResult {
  schema_version: 1;
  case_id: string;
  case_sha256: string;
  facts_sha256: string;
  summary: LlmClaim;
  strengths: LlmClaim[];
  technologies: Array<{
    name: string;
    version: string | null;
    certainty: "observed" | "inferred" | "unknown";
    statement: string;
    fact_ids: string[];
  }>;
  opportunities: LlmOpportunity[];
  unknowns: string[];
  next_questions: string[];
}
