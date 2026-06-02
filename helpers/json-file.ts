/**
 * 指定されたパスにJSONファイルを保存する。
 *
 * 必要なフォルダがなければ作る
 * JSON.stringify(data, null, 2) を共通化する
 *
 * @param file_path JSONファイルの保存先パス
 * @param data JSONとして保存したいデータ
 */

import fs from "fs";
import path from "path";

export function saveJsonFile(file_path: string, data: unknown): void {
  // ファイルパスから、親フォルダのパスを取り出す(フォルダ部分だけを取り出す)
  const dir_path = path.dirname(file_path);

  // フォルダを作る。すでに途中のフォルダがなければまとめて作る
  fs.mkdirSync(dir_path, {
    recursive: true,
  });

  // summaryPath の場所にsmokeSummary を JSON文字列に変換してUTF-8文字コードで保存する
  fs.writeFileSync(
    file_path,
    JSON.stringify(data, null, 2),
    "utf-8",
  );
}