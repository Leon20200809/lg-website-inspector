import type { Page } from "@playwright/test";

import type { HeadingItem, HeadingSummary } from "../types/heading-summary";

/** ページ内のh1〜h3から見出し情報を収集する。 */
export async function collectHeadingItems(page: Page): Promise<HeadingItem[]> {
  const headingElements = page.locator("h1, h2, h3");

  return headingElements.evaluateAll((elements) => {
    return elements.map((element, index) => {
      const level = Number(element.tagName.slice(1)) as HeadingItem["level"];

      const text = (element.textContent ?? "").trim().replace(/\s+/g, " ");

      return {
        level,
        text,
        order: index + 1,
      };
    });
  });
}

/** 収集した見出し情報をページ全体の集計へ反映する。 */
export function applyHeadingSummary(
  summary: HeadingSummary,
  headings: HeadingItem[],
): void {
  summary.headings = headings;

  summary.total_headings = headings.length;

  summary.h1_count = headings.filter((heading) => heading.level === 1).length;

  summary.h2_count = headings.filter((heading) => heading.level === 2).length;

  summary.h3_count = headings.filter((heading) => heading.level === 3).length;

  summary.empty_heading_count = headings.filter(
    (heading) => heading.text === "",
  ).length;
}
