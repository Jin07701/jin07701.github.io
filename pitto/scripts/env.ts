import { existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * .env.local → .env の順に読み込む。
 * すでに環境変数として入っている値は上書きしない。
 */
export function loadEnv(): void {
  for (const file of [".env.local", ".env"]) {
    const path = resolve(process.cwd(), file);
    if (!existsSync(path)) continue;
    try {
      process.loadEnvFile(path);
    } catch {
      // すでに同じキーが設定済みの場合など。読めない .env は無視して進む。
    }
  }
}

export function requireDatabaseUrl(): string {
  loadEnv();
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL が設定されていません。cp .env.example .env.local して接続先を書いてください。",
    );
  }
  return url;
}
