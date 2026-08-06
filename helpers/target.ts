import type { TargetSite } from "../types/target-site";

/**
 * 有効な（is_active: true）テスト対象サイトだけをフィルタリングして返す
 */
export const getActiveTargetSites = (): TargetSite[] => {
  return target_sites.filter((site) => site.is_active);
};

// ここにオブジェクトを足すだけ
export const target_sites: TargetSite[] = [
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
    is_active: true,
    expected_title_keywords: ["ロジカルスタジオ"],
    allow_form_submit: false,
  },
  {
    id: "espo-nagahoribashi",
    name: "espo長堀橋",
    base_url: "https://e-spo.org/",
    mode: "external",
    is_active: false,
    expected_title_keywords: ["A型事業所", "就職", "見学"],
    allow_form_submit: false,
  },
];
