import "server-only";

import { cookies } from "next/headers";

import { sql } from "./db";

const COOKIE_NAME = "pitto_uid";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 400;

/**
 * 利用者の識別。
 *
 * Phase 1 では §9 の SMS/メール認証はまだ入れず、推測困難な UUID を httpOnly Cookie に
 * 保持するだけにしている。§10 の「2回目以降は Cookie で継続」に相当する部分で、
 * Phase 2 で Stripe の顧客登録と電話番号認証をこの上に重ねる。
 */
export async function getCurrentUserId(): Promise<string | null> {
  const store = await cookies();
  const value = store.get(COOKIE_NAME)?.value;
  if (!value) return null;

  const rows = await sql<{ id: string }[]>`
    select id from users where id = ${value}::uuid
  `;
  return rows[0]?.id ?? null;
}

/** 既存の利用者を返す。いなければ作る。利用開始の直前にだけ呼ぶ。 */
export async function getOrCreateUserId(): Promise<string> {
  const existing = await getCurrentUserId();
  if (existing) return existing;

  const [user] = await sql<{ id: string }[]>`
    insert into users default values returning id
  `;

  const store = await cookies();
  store.set(COOKIE_NAME, user.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });

  return user.id;
}
