#!/usr/bin/env bash

# JSON出力ごとのTypeScript型ファイルを作成する初期化スクリプト

set -e

TYPE_DIR="types"

mkdir -p "$TYPE_DIR"

create_file() {
  local file_path="$1"
  local comment="$2"

  if [[ -e "$file_path" ]]; then
    echo "SKIP: $file_path は既に存在します"
    return
  fi

  cat > "$file_path" <<EOF
/**
 * ${comment}
 */

EOF

  echo "CREATE: $file_path"
}

create_file "$TYPE_DIR/common.ts" \
  "各検査JSONで共通して使用する型を定義する。"

create_file "$TYPE_DIR/inspection-meta.ts" \
  "検査日時・対象・実行条件・検査成否の型を定義する。"

create_file "$TYPE_DIR/meta-summary.ts" \
  "title・meta description・canonical・言語情報の型を定義する。"

create_file "$TYPE_DIR/heading-summary.ts" \
  "ページ内の見出し構造とテキスト情報の型を定義する。"

create_file "$TYPE_DIR/image-summary.ts" \
  "画像・alt属性・読み込み状態の型を定義する。"

create_file "$TYPE_DIR/link-summary.ts" \
  "リンク分類・HTTP状態・リンク切れ情報の型を定義する。"

create_file "$TYPE_DIR/form-summary.ts" \
  "フォーム・入力項目・必須属性・ラベル情報の型を定義する。"

create_file "$TYPE_DIR/console-summary.ts" \
  "ブラウザコンソールエラーと通信失敗情報の型を定義する。"

echo "型ファイルの初期作成が完了しました"