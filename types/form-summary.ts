/**
 * フォーム・入力項目・必須属性・ラベル情報の型を定義する。
 */

import type { BaseInspectionSummary } from "./common";

// フォーム内のHTML要素
export type FormFieldElement = "input" | "textarea" | "select" | "button";

// ラベルの確認状態
export type FormLabelStatus = "present" | "missing" | "not_applicable";

// フォーム内に存在する1つの入力要素
export interface FormFieldItem {
  order: number;
  element: FormFieldElement;
  input_type: string | null;

  name: string | null;
  id: string | null;

  label_text: string | null;
  label_status: FormLabelStatus;

  required: boolean;
  disabled: boolean;
  readonly: boolean;

  placeholder: string | null;
  autocomplete: string | null;
}

// ページ内に存在する1つのフォーム
export interface FormItem {
  order: number;

  action: string;
  method: string;

  field_count: number;
  required_field_count: number;
  missing_label_count: number;

  submit_button_found: boolean;
  privacy_consent_found: boolean;

  fields: FormFieldItem[];
}

// ページ全体のフォーム情報
export interface FormSummary extends BaseInspectionSummary {
  form_found: boolean;
  total_forms: number;
  total_fields: number;
  total_required_fields: number;
  total_missing_labels: number;

  form_submit_tested: false;

  forms: FormItem[];
}
