import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { InitialInspectionConfig, ScopeDecision } from "../types/initial-report";
import type { LinkItem } from "../types/link-summary";

/** 認証情報を含まないHTTP/HTTPS URLを検証し、末尾スラッシュを保ったままハッシュを除く。 */
export function normalizeInspectionUrl(input: string): string {
  const url = new URL(input);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new Error("認証情報を含まないhttp/httpsの公開URLを指定してください。");
  }
  url.hash = "";
  return url.href;
}

/** 入力URLと任意設定を検証し、初回点検の対象範囲と既定値を組み立てる。 */
export function createInitialConfig(input: string, options: Partial<InitialInspectionConfig> = {}): InitialInspectionConfig {
  const url = normalizeInspectionUrl(input);
  const parsed = new URL(url);
  const maxPages = options.max_pages ?? 5;
  const timeout = options.timeout_ms ?? 15000;
  const delay = options.delay_ms ?? 500;
  if (!Number.isInteger(maxPages) || maxPages < 1 || maxPages > 20) throw new Error("max_pagesは1〜20にしてください。");
  if (!Number.isInteger(timeout) || timeout < 1000 || timeout > 60000) throw new Error("timeout_msは1000〜60000にしてください。");
  if (!Number.isInteger(delay) || delay < 0 || delay > 10000) throw new Error("delay_msは0〜10000にしてください。");
  const origins = [...new Set([parsed.origin, ...(options.allowed_origins ?? []).map(value => new URL(normalizeInspectionUrl(value)).origin)])];
  const important = (options.important_urls ?? []).map(normalizeInspectionUrl);
  const excluded = (options.excluded_urls ?? []).map(normalizeInspectionUrl);
  if (important.some(value => !origins.includes(new URL(value).origin))) throw new Error("重要URLはallowed_origins内に限定してください。");
  if (excluded.includes(url)) throw new Error("起点URLを除外URLには指定できません。");
  return {
    url,
    site_id: `${parsed.hostname.replace(/[^a-z0-9.-]/gi, "_")}-${createHash("sha256").update(parsed.origin).digest("hex").slice(0, 8)}`,
    display_name: options.display_name?.trim() || parsed.hostname,
    purpose: options.purpose?.trim() || null,
    concern: options.concern?.trim() || null,
    allowed_origins: origins,
    important_urls: important,
    excluded_urls: excluded,
    max_pages: maxPages,
    timeout_ms: timeout,
    delay_ms: delay,
    allow_local: options.allow_local === true,
  };
}

/** IPアドレスが、この点検で許可する公開アドレス範囲か判定する。 */
export function isPublicAddress(address: string): boolean {
  const ip = address.replace(/^\[|\]$/g, "").toLowerCase();
  if (isIP(ip) === 4) {
    const [a = 0, b = 0, c = 0] = ip.split(".").map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
      (a === 192 && b === 0 && [0, 2].includes(c)) || (a === 198 && [18, 19].includes(b)) ||
      (a === 198 && b === 51 && c === 100) ||
      (a === 203 && b === 0 && c === 113));
  }
  // Globally routable unicast only. Mapped/local/multicast/documentation ranges are excluded.
  return isIP(ip) === 6 && /^[23][0-9a-f]{0,3}:/.test(ip) && !ip.startsWith("2001:db8:");
}

/** URLのホストを名前解決し、明示許可したlocalhost以外への非公開接続を拒否する。 */
export async function assertPublicUrl(input: string, allowLocal = false): Promise<void> {
  const url = new URL(normalizeInspectionUrl(input));
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (allowLocal && ["127.0.0.1", "localhost", "::1"].includes(host)) return;
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) throw new Error("公開ホストを指定してください。");
  // An explicit operator option for proxy-only environments; never skip address checks.
  const addresses = isIP(host) ? [{ address: host }] : process.env.LGWI_DNS_MODE === "https"
    ? await lookupOverHttps(host) : await lookup(host, { all: true });
  if (!addresses.length || addresses.some(item => !isPublicAddress(item.address))) throw new Error("公開IPアドレス以外への接続は対象外です。");
}

/** 公開DNSへHTTPSで問い合わせ、ホストのIPv4・IPv6アドレスを取得する。 */
async function lookupOverHttps(host: string): Promise<{ address: string }[]> {
  const records = await Promise.all(["A", "AAAA"].map(async type => {
    const endpoint = new URL("https://dns.google/resolve");
    endpoint.searchParams.set("name", host); endpoint.searchParams.set("type", type);
    const response = await fetch(endpoint, { signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error(`公開DNSの応答を取得できませんでした: ${response.status}`);
    const result = await response.json() as { Status?: number; Answer?: { type: number; data: string }[] };
    if (result.Status !== 0) throw new Error("公開DNSでホストを確認できませんでした。");
    return (result.Answer ?? []).filter(item => item.type === 1 || item.type === 28).map(item => ({ address: item.data }));
  }));
  return records.flat();
}

/** URLが点検範囲から外れる理由を返し、対象にできる場合はnullを返す。 */
export function scopeExclusionReason(url: string, config: InitialInspectionConfig): string | null {
  const parsed = new URL(url);
  if (!config.allowed_origins.includes(parsed.origin)) return "許可origin外";
  if (config.excluded_urls.includes(url)) return "指定除外URL";
  if (/\.(pdf|jpe?g|png|gif|svg|webp|zip|xlsx?|docx?|mp4|mp3)$/i.test(parsed.pathname)) return "HTMLページ以外";
  if (/\b(logout|signout|delete|remove|unsubscribe|checkout|cart|wp-admin|wp-login)\b/i.test(parsed.pathname + parsed.search)) return "状態変更・管理用の可能性があるURL";
  return null;
}

/** 起点・重要URL・起点のリンクを優先順に並べ、上限内の点検対象を選ぶ。 */
export function selectInitialScope(config: InitialInspectionConfig, links: LinkItem[], finalRootUrl = config.url): ScopeDecision[] {
  const candidates = new Map<string, { label: string; rank: number }>();
  candidates.set(config.url, { label: "起点", rank: -2 });
  for (const url of config.important_urls) if (!candidates.has(url)) candidates.set(url, { label: "指定重要ページ", rank: -1 });
  for (const link of links) {
    if (!link.resolved_url || link.is_empty_href || link.is_placeholder || !/^https?:/i.test(link.resolved_url)) continue;
    let url: string;
    try { url = normalizeInspectionUrl(link.resolved_url); } catch { continue; }
    if (url === normalizeInspectionUrl(finalRootUrl)) continue;
    if (candidates.has(url)) continue;
    const rank = /contact|about|company|service|usage|business|問い合わせ|会社|事業|サービス|利用/i.test(url + " " + link.text) ? 0 : 1;
    candidates.set(url, { label: "起点からのリンク", rank });
  }
  let selected = 0;
  return [...candidates.entries()].sort((a, b) => a[1].rank - b[1].rank).map(([url, value]) => {
    const reason = scopeExclusionReason(url, config);
    if (reason) return { url, selected: false, reason };
    if (selected >= config.max_pages) return { url, selected: false, reason: "ページ数上限" };
    selected++;
    return { url, selected: true, reason: value.label };
  });
}
