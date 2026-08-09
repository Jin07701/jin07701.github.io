"use server";

import { redirect } from "next/navigation";

import type { ActionState } from "@/lib/action-state";
import { getAccount, login, logout } from "@/server/auth";

/** オープンリダイレクトを避けるため、同一サイト内の絶対パスだけを許可する。 */
function safeNext(value: string | null): string | null {
  if (!value) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  return value;
}

export async function loginAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("next") ? String(formData.get("next")) : null);

  if (!email || !password) {
    return { error: "メールアドレスとパスワードを入力してください。" };
  }

  if (!(await login(email, password))) {
    // どちらが違うかは伝えない。
    return { error: "メールアドレスまたはパスワードが正しくありません。" };
  }

  if (next) redirect(next);

  // 行き先が指定されていなければ、権限に合う画面へ送る。
  const account = await getAccount();
  redirect(account?.isStaff ? "/admin" : account?.ownerId ? "/owner" : "/");
}

export async function logoutAction(): Promise<void> {
  await logout();
  redirect("/");
}
