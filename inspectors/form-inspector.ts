/**
 * ページ内のフォーム構造を収集し、
 * フォーム検査結果へ集計を反映する。
 *
 * フォームへの入力・クリック・送信は行わない。
 */

import type { Page } from "@playwright/test";

import { FORM_FIELD_ELEMENT, FORM_LABEL_STATUS } from "../types/form-summary";

import type {
  FormFieldElement,
  FormFieldItem,
  FormItem,
  FormLabelStatus,
  FormSummary,
} from "../types/form-summary";

/**
 * ページ内に存在するフォームと入力項目の構造を収集する。
 *
 * form要素ごとに、送信先・送信方式・入力項目・ラベル・
 * 必須指定・送信ボタン・プライバシー同意候補を調べる。
 *
 * この関数はフォームへの入力・クリック・送信を行わず、
 * 現在のDOMから読み取れる情報だけを返す。
 *
 * @param page 検査対象ページを操作するPlaywrightのPage
 * @returns ページ内に存在するフォーム情報の配列
 */
export async function collectFormItems(page: Page): Promise<FormItem[]> {
  return page.locator("form").evaluateAll(
    (formElements, statuses) => {
      /**
       * 改行や連続した空白を整理し、
       * 空文字ならnullへ変換する。
       */
      const normalizeText = (
        value: string | null | undefined,
      ): string | null => {
        if (value === null || value === undefined) {
          return null;
        }

        const normalized = value.replace(/\s+/g, " ").trim();

        return normalized === "" ? null : normalized;
      };

      /**
       * aria-labelledbyで指定された要素の文字を取得する。
       *
       * 例:
       * aria-labelledby="name-label name-help"
       */
      const getAriaLabelledByText = (control: HTMLElement): string | null => {
        const ariaLabelledBy = control.getAttribute("aria-labelledby");

        if (!ariaLabelledBy) {
          return null;
        }

        const texts = ariaLabelledBy
          .split(/\s+/)
          .map((id) => {
            const referencedElement = document.getElementById(id);

            return normalizeText(referencedElement?.textContent);
          })
          .filter((text): text is string => text !== null);

        return normalizeText(texts.join(" "));
      };

      /**
       * 入力項目に関連付けられたラベル文字を取得する。
       *
       * 1. label for属性・内包label
       * 2. aria-label
       * 3. aria-labelledby
       *
       * の順番で確認する。
       */
      const getLabelText = (
        control:
          | HTMLInputElement
          | HTMLTextAreaElement
          | HTMLSelectElement
          | HTMLButtonElement,
      ): string | null => {
        const htmlLabelText = Array.from(control.labels ?? [])
          .map((label) => normalizeText(label.textContent))
          .filter((text): text is string => text !== null)
          .join(" ");

        const normalizedHtmlLabel = normalizeText(htmlLabelText);

        if (normalizedHtmlLabel) {
          return normalizedHtmlLabel;
        }

        const ariaLabel = normalizeText(control.getAttribute("aria-label"));

        if (ariaLabel) {
          return ariaLabel;
        }

        return getAriaLabelledByText(control);
      };

      /**
       * ラベル確認が必要な入力項目か判定する。
       *
       * hiddenや送信ボタンなどは、
       * 通常の入力ラベル確認の対象外とする。
       */
      const isLabelApplicable = (
        element: FormFieldElement,
        inputType: string | null,
      ): boolean => {
        if (element === statuses.field.BUTTON) {
          return false;
        }

        if (element !== statuses.field.INPUT) {
          return true;
        }

        const notApplicableInputTypes = [
          "hidden",
          "submit",
          "reset",
          "button",
          "image",
        ];

        return !notApplicableInputTypes.includes(inputType ?? "");
      };

      /**
       * 個人情報・規約同意に関係しそうな
       * チェックボックスか判定する。
       *
       * これは確定判定ではなく、文字情報による候補検出。
       */
      const privacyPattern =
        /個人情報|プライバシー|同意|利用規約|規約|privacy|consent|agree|terms/i;

      return formElements.map((formElement, formIndex) => {
        const form = formElement as HTMLFormElement;

        const controls = Array.from(
          form.querySelectorAll("input, textarea, select, button"),
        ) as Array<
          | HTMLInputElement
          | HTMLTextAreaElement
          | HTMLSelectElement
          | HTMLButtonElement
        >;

        const fields: FormFieldItem[] = controls.map((control, fieldIndex) => {
          const element = control.tagName.toLowerCase() as FormFieldElement;

          const inputType =
            control instanceof HTMLInputElement ? control.type : null;

          const labelText = getLabelText(control);

          // 3種類すべて代入できるよう型を明示する
          let labelStatus: FormLabelStatus = statuses.label.PRESENT;

          if (!isLabelApplicable(element, inputType)) {
            labelStatus = statuses.label.NOT_APPLICABLE;
          } else if (labelText === null) {
            labelStatus = statuses.label.MISSING;
          }

          // HTML標準・ARIA・Contact Form 7独自クラスから必須項目を判定する
          const required =
            control instanceof HTMLInputElement ||
            control instanceof HTMLTextAreaElement ||
            control instanceof HTMLSelectElement
              ? control.required ||
                control.getAttribute("aria-required") === "true" ||
                control.classList.contains("wpcf7-validates-as-required")
              : false;

          const readonly =
            control instanceof HTMLInputElement ||
            control instanceof HTMLTextAreaElement
              ? control.readOnly
              : false;

          return {
            // フォーム内での出現順
            order: fieldIndex + 1,

            element,
            input_type: inputType,

            name: control.getAttribute("name"),
            id: control.getAttribute("id"),

            label_text: labelText,
            label_status: labelStatus,

            required,
            disabled: control.disabled,
            readonly,

            placeholder: control.getAttribute("placeholder"),

            autocomplete: control.getAttribute("autocomplete"),
          };
        });

        const submitButtonFound = controls.some((control) => {
          if (control instanceof HTMLInputElement) {
            return control.type === "submit" || control.type === "image";
          }

          if (control instanceof HTMLButtonElement) {
            /*
             * buttonはtype属性を省略した場合も、
             * form内では通常submitとして扱われる。
             */
            return control.type === "submit";
          }

          return false;
        });

        const privacyConsentFound = controls.some((control) => {
          if (
            !(control instanceof HTMLInputElement) ||
            control.type !== "checkbox"
          ) {
            return false;
          }

          const evidenceText = [
            getLabelText(control),
            control.name,
            control.id,
            control.value,
            control.getAttribute("aria-label"),
          ]
            .filter((value): value is string => Boolean(value))
            .join(" ");

          return privacyPattern.test(evidenceText);
        });

        const requiredFieldCount = fields.filter(
          (field) => field.required,
        ).length;

        const missingLabelCount = fields.filter(
          (field) => field.label_status === statuses.label.MISSING,
        ).length;

        return {
          // ページ内でのフォーム出現順
          order: formIndex + 1,

          // HTMLに書かれたaction属性
          action_attribute: form.getAttribute("action"),

          // ブラウザが絶対URLへ変換した送信先
          action: form.action,

          // GET・POSTなどを大文字へ統一する
          method: form.method.toUpperCase(),

          // application/x-www-form-urlencodedなど
          enctype: form.enctype,

          field_count: fields.length,
          required_field_count: requiredFieldCount,
          missing_label_count: missingLabelCount,

          submit_button_found: submitButtonFound,

          privacy_consent_found: privacyConsentFound,

          fields,
        };
      });
    },

    /*
     * Node.js側でimportした定数を、
     * evaluateAll()内のブラウザ側へ渡す。
     */
    {
      field: FORM_FIELD_ELEMENT,
      label: FORM_LABEL_STATUS,
    },
  );
  // 現在form.spec.tsにある状態定数
}

/**
 * 収集したフォーム情報を、ページ全体の集計結果へ反映する。
 *
 * フォーム数・入力項目数・必須項目数・
 * ラベル欠落数を集計し、FormSummaryを更新する。
 *
 * DOMの取得やフォーム送信は行わず、
 * collectFormItems()が返した結果だけを使用する。
 *
 * @param summary 更新対象となるフォーム検査結果
 * @param forms ページ内から収集したフォーム情報
 */
export function applyFormSummary(
  summary: FormSummary,
  forms: FormItem[],
): void {
  // フォームの詳細情報を検査結果へ保存する
  summary.forms = forms;

  // フォームが1件以上存在するか判定する
  summary.form_found = forms.length > 0;

  // ページ内のフォーム総数を保存する
  summary.total_forms = forms.length;

  // 各フォームの入力項目数を合計する
  summary.total_fields = forms.reduce(
    (total, form) => total + form.field_count,
    0,
  );

  // 各フォームの必須項目数を合計する
  summary.total_required_fields = forms.reduce(
    (total, form) => total + form.required_field_count,
    0,
  );

  // 各フォームのラベル欠落数を合計する
  summary.total_missing_labels = forms.reduce(
    (total, form) => total + form.missing_label_count,
    0,
  );
}
