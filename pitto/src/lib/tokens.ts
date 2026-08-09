import { randomBytes } from "node:crypto";

/**
 * QRトークンの生成。
 *
 * §34 のとおり連番IDは絶対にURLへ出さない。/space/123 のような形は禁止で、
 * 推測困難なトークンだけを公開する。
 *
 * 文字集合は Crockford Base32 から I/L/O/U を除いたもの。
 * 大文字英数字だけなのでQRコードの英数字モードに乗り、
 * 印刷物を人が読み上げても取り違えにくい。
 */
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** 既定の長さ。32^24 ≒ 2^120 で総当たりは現実的でない。 */
const DEFAULT_LENGTH = 24;

export function generateQrToken(length: number = DEFAULT_LENGTH): string {
  if (length < 16) {
    throw new Error("QRトークンは16文字以上にしてください");
  }

  // 256 は 32 の倍数なので、バイトを剰余で畳んでも偏りは出ない。
  const bytes = randomBytes(length);
  let token = "";
  for (let i = 0; i < length; i += 1) {
    token += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return token;
}

/** 受け取った文字列がトークンの形式を満たすか。DB を叩く前の門前払い用。 */
export function isValidQrTokenFormat(token: string): boolean {
  if (token.length < 16 || token.length > 64) return false;
  for (const char of token) {
    if (!ALPHABET.includes(char)) return false;
  }
  return true;
}

/** 決済の冪等キー。§34 の idempotency 対応で使う。 */
export function generateIdempotencyKey(): string {
  return randomBytes(24).toString("base64url");
}
