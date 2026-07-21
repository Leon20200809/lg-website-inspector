/**
 * 現在日時を日本時間のISO形式で返す。
 */
export function getJapanIsoString(): string {
  const now = new Date();

  // 日本時間はUTCより9時間進んでいる
  const japanTime = new Date(now.getTime() + 9 * 60 * 60 * 1000);

  // toISOString()で作った日時のUTC表記を日本時間表記へ変更する
  return japanTime.toISOString().replace("Z", "+09:00");
}
