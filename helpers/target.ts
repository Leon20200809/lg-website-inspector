// 動作モードの定義
export type TargetSiteMode = 'own' | 'external' | 'demo';

// サイト情報の型定義
export interface TargetSite {
  name: string;
  base_url: string;
  mode: TargetSiteMode;
  is_active: boolean;
  expected_title_keywords: string[];
  allow_form_submit: boolean;
}

/**
 * 有効な（is_active: true）テスト対象サイトだけをフィルタリングして返す
 */
export const getActiveTargetSites = (): TargetSite[] => {
  return target_sites.filter(site => site.is_active);
};

// ここにオブジェクトを足すだけ
export const target_sites: TargetSite[] = [
  {
    name: 'LazyGenius.dev',
    base_url: 'https://lazygenius.dev/',
    mode: 'own',
    is_active: false,
    expected_title_keywords: ['LazyGenius', 'Leon', 'Web', 'WordPress'],
    allow_form_submit: false,
  },
  {
    name: 'Example Site',
    base_url: 'https://example.com/',
    mode: 'demo',
    is_active: false,
    expected_title_keywords: ['Example'],
    allow_form_submit: false,
  },
  {
    name: 'espo長堀橋',
    base_url: 'https://e-spo.org/',
    mode: 'external',
    is_active: true,
    expected_title_keywords: ['A型事業所', '就職', '見学'],
    allow_form_submit: false,
  },
];