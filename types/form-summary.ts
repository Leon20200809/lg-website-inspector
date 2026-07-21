/**
 * フォーム・入力項目・必須属性・ラベル情報の型を定義する。
 */

import type { BaseInspectionSummary } from "./common";

// フォーム内のHTML要素を定数として管理する
export const FORM_FIELD_ELEMENT = {
  INPUT: "input",
  TEXTAREA: "textarea",
  SELECT: "select",
  BUTTON: "button",
} as const;

// フォーム内のHTML要素型を定数から生成する
export type FormFieldElement =
  (typeof FORM_FIELD_ELEMENT)[keyof typeof FORM_FIELD_ELEMENT];

// ラベルの確認状態を定数として管理する
export const FORM_LABEL_STATUS = {
  PRESENT: "present",
  MISSING: "missing",
  NOT_APPLICABLE: "not_applicable",
} as const;

// ラベルの確認状態型を定数から生成する
export type FormLabelStatus =
  (typeof FORM_LABEL_STATUS)[keyof typeof FORM_LABEL_STATUS];

// フォーム内に存在する1つの入力要素
export interface FormFieldItem {
  // フォーム内での出現順
  order: number;

  // input・textarea・select・buttonの分類
  element: FormFieldElement;

  // input要素のtype属性。input以外はnull
  input_type: string | null;

  // 送信時の項目名
  name: string | null;

  // labelとの関連付けなどに使用されるid
  id: string | null;

  // 関連付けられたlabelの文字
  label_text: string | null;

  // labelあり・欠落・対象外の分類
  label_status: FormLabelStatus;

  // 入力必須か
  required: boolean;

  // 操作不能か
  disabled: boolean;

  // 読み取り専用か
  readonly: boolean;

  // 入力例として表示される文字
  placeholder: string | null;

  // ブラウザの自動入力指定
  autocomplete: string | null;
}

// ページ内に存在する1つのフォーム
export interface FormItem {
  // ページ内での出現順
  order: number;

  // HTMLのaction属性をそのまま取得する
  action_attribute: string | null;

  // ブラウザが絶対URLへ解決した送信先
  action: string;

  // GET・POSTなどの送信方式
  method: string;

  // 送信データのエンコード方式
  enctype: string;

  // フォーム内の対象要素数
  field_count: number;

  // 必須項目数
  required_field_count: number;

  // labelが欠落している入力項目数
  missing_label_count: number;

  // 送信ボタンが存在するか
  submit_button_found: boolean;

  // 個人情報・プライバシー同意項目らしき要素が存在するか
  privacy_consent_found: boolean;

  // フォーム内の各入力要素
  fields: FormFieldItem[];
}

// ページ全体のフォーム情報
export interface FormSummary extends BaseInspectionSummary {
  // form要素が1つ以上存在するか
  form_found: boolean;

  // ページ内のform要素数
  total_forms: number;

  // 全フォーム内の対象要素数
  total_fields: number;

  // 全フォーム内の必須項目数
  total_required_fields: number;

  // 全フォーム内のlabel欠落数
  total_missing_labels: number;

  // Inspectorは実際のフォーム送信を行わない
  form_submit_tested: false;

  // ページ内の各フォーム
  forms: FormItem[];
}
