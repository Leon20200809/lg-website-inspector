/** 公開ページから取得した技術判定用の根拠を表す。 */
export interface TechnologyEvidence {
  id: string;
  source: "runtime" | "script_src" | "stylesheet_href" | "meta_generator" | "dom_marker" | "response_header";
  key: string;
  value: string;
}

/** 実行時の自己申告と参照名からの推定を区別した技術候補を表す。 */
export interface TechnologyDetection {
  name: string;
  category: "library" | "framework" | "cms" | "analytics" | "external_service";
  confidence: "runtime_observed" | "declared" | "reference_only";
  version: string | null;
  version_source: "runtime" | "declaration" | "filename" | null;
  evidence_ids: string[];
  note: string;
}

/** 追加の通信や操作をせずに取得できた技術情報と判定限界を保持する。 */
export interface TechnologyObservation {
  schema_version: 1;
  evidence: TechnologyEvidence[];
  detections: TechnologyDetection[];
  unknowns: string[];
  limitations: string[];
}
