import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

/**
 * パスワードのハッシュ化。
 *
 * `scrypt$<salt(hex)>$<hash(hex)>` の形で保存する。
 * 追加の依存を増やさないため node:crypto だけで組んでいる。
 * シード用スクリプトからも使うので、ここは "server-only" を付けない。
 */
const KEY_LENGTH = 64;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, KEY_LENGTH);
  return `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string | null): boolean {
  if (!stored) return false;

  const [scheme, saltHex, hashHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;

  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(password, Buffer.from(saltHex, "hex"), expected.length);
  return timingSafeEqual(expected, actual);
}
