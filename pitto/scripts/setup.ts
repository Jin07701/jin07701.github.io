import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * 初回セットアップ。.env.example から .env.local を作り、AUTH_SECRET だけ生成して差し込む。
 *
 * Windows と macOS / Linux で同じように動かせるよう、シェルではなく Node で書いている。
 */
const PLACEHOLDER = "change-me-to-a-random-string-at-least-32-chars";

const target = resolve(process.cwd(), ".env.local");
const template = resolve(process.cwd(), ".env.example");

if (existsSync(target)) {
  console.log(".env.local はすでにあるので、そのまま使います。");
  process.exit(0);
}

if (!existsSync(template)) {
  console.error(".env.example が見つかりません。プロジェクトのルートで実行してください。");
  process.exit(1);
}

const secret = randomBytes(32).toString("base64url");
writeFileSync(target, readFileSync(template, "utf8").replace(PLACEHOLDER, secret));

console.log(".env.local を作成しました。AUTH_SECRET は自動生成しています。");
console.log("接続先を変える場合は .env.local の DATABASE_URL を編集してください。");
