import Link from "next/link";

import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  not_owner: "このアカウントにはオーナー登録がありません。",
  not_staff: "このアカウントには管理画面の権限がありません。",
};

/**
 * オーナー(§25)と運営者(§27)のログイン。
 * 利用者側はログインなしで使えるため、この画面には来ない。
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-5 py-12">
      <Link href="/" className="text-sm font-bold tracking-widest text-accent">
        PITTO
      </Link>
      <h1 className="mt-3 text-2xl font-bold">ログイン</h1>
      <p className="mt-2 text-sm text-ink-soft">
        スペースをお貸しいただいているオーナーと、PITTO運営者向けの画面です。
      </p>

      {error && ERRORS[error] ? (
        <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          {ERRORS[error]}
        </p>
      ) : null}

      <LoginForm next={next ?? null} />

      <p className="mt-6 text-xs leading-relaxed text-ink-soft">
        自転車を停めるだけならログインは必要ありません。現地の区画QRを読み取ってください。
      </p>
    </main>
  );
}
