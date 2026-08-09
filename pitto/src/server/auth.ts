import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { verifyPassword } from "@/lib/password";

import { sql } from "./db";

const COOKIE_NAME = "pitto_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

function secret(): string {
  const value = process.env.AUTH_SECRET;
  if (!value || value.length < 32) {
    throw new Error(
      "AUTH_SECRET が未設定か短すぎます。32文字以上のランダムな値を .env.local に設定してください。",
    );
  }
  return value;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

/** Cookie に入れる値。中身は改ざんできないよう HMAC で署名する。 */
function issueToken(userId: string): string {
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS;
  const payload = `${userId}.${expiresAt}`;
  return `${payload}.${sign(payload)}`;
}

function readToken(token: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [userId, expiresAt, signature] = parts;
  const expected = sign(`${userId}.${expiresAt}`);

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  if (Number(expiresAt) * 1000 < Date.now()) return null;

  return userId;
}

export type Account = {
  userId: string;
  email: string | null;
  isStaff: boolean;
  /** オーナーとして登録済みなら、その owners.id と状態。 */
  ownerId: string | null;
  ownerStatus: "PENDING_REVIEW" | "APPROVED" | "SUSPENDED" | null;
};

/** ログイン中のアカウント。未ログインなら null。 */
export async function getAccount(): Promise<Account | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const userId = readToken(token);
  if (!userId) return null;

  const rows = await sql<
    {
      id: string;
      email: string | null;
      is_staff: boolean;
      owner_id: string | null;
      owner_status: Account["ownerStatus"];
    }[]
  >`
    select u.id, u.email, u.is_staff, o.id as owner_id, o.status as owner_status
    from users u
    left join owners o on o.user_id = u.id
    where u.id = ${userId}::uuid
  `;

  const row = rows[0];
  if (!row) return null;

  return {
    userId: row.id,
    email: row.email,
    isStaff: row.is_staff,
    ownerId: row.owner_id,
    ownerStatus: row.owner_status,
  };
}

/** メールとパスワードで認証する。成功したら Cookie を張る。 */
export async function login(email: string, password: string): Promise<boolean> {
  const rows = await sql<{ id: string; password_hash: string | null }[]>`
    select id, password_hash from users where email = ${email.trim().toLowerCase()}
  `;

  const user = rows[0];
  if (!user || !verifyPassword(password, user.password_hash)) {
    return false;
  }

  const store = await cookies();
  store.set(COOKIE_NAME, issueToken(user.id), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: "/",
  });

  await sql`
    insert into audit_logs (actor_user_id, action, entity_type, entity_id)
    values (${user.id}::uuid, 'auth.login', 'user', ${user.id})
  `;

  return true;
}

export async function logout(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

/** オーナー画面のガード。承認済みのオーナーだけ通す。 */
export async function requireOwner(): Promise<Account & { ownerId: string }> {
  const account = await getAccount();
  if (!account) redirect("/login?next=/owner");
  if (!account.ownerId) redirect("/login?error=not_owner");
  // §20 審査を通っていないオーナーは駐輪場を運用できない。
  if (account.ownerStatus !== "APPROVED") redirect("/owner/pending");

  return { ...account, ownerId: account.ownerId };
}

/** §27 運営者の管理画面のガード。 */
export async function requireStaff(): Promise<Account> {
  const account = await getAccount();
  if (!account) redirect("/login?next=/admin");
  if (!account.isStaff) redirect("/login?error=not_staff");
  return account;
}
