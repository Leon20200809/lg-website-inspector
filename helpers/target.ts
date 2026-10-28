import type { TargetSite } from "../types/target-site";

// ここにオブジェクトを足すだけ
export const targetSites: TargetSite[] = [
  {
    id: "LazyGenius",
    name: "LazyGenius.dev",
    base_url: "https://lazygenius.dev/",
    mode: "own",
    is_active: false,
    expected_title_keywords: ["LazyGenius", "Leon", "Web", "WordPress"],
    allow_form_submit: false,
  },
  {
    id: "logicalStudio",
    name: "logical-studio.com",
    base_url: "https://recruit.logical-studio.com/",
    mode: "external",
    is_active: false,
    expected_title_keywords: ["ロジカルスタジオ"],
    allow_form_submit: false,
  },
  {
    id: "espo-nagahoribashi",
    name: "espo長堀橋",
    base_url: "https://e-spo.org/",
    mode: "external",
    is_active: true,
    expected_title_keywords: ["A型事業所", "就職", "見学"],
    allow_form_submit: false,
  },
];

/** 有効なテスト対象サイトだけを返す。 */
export const getActiveTargetSites = (): TargetSite[] => {
  return targetSites.filter((site) => site.is_active);
};
