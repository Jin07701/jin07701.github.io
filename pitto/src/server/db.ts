import "server-only";

import postgres from "postgres";

declare global {
  // 開発時の HMR で接続が増え続けないよう、グローバルに1本だけ保持する。
  // eslint-disable-next-line no-var
  var __pittoSql: postgres.Sql | undefined;
}

function createClient(): postgres.Sql {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL が設定されていません。.env.example をコピーして .env.local を作成してください。",
    );
  }

  return postgres(url, {
    // 金額は円(整数)で扱う。数値型が文字列で返ると計算を誤るため明示的に変換する。
    transform: { undefined: null },
    max: 10,
    idle_timeout: 20,
  });
}

export const sql: postgres.Sql = globalThis.__pittoSql ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__pittoSql = sql;
}
