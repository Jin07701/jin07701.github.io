"use client";

import { useActionState } from "react";

import { loginAction } from "@/app/auth-actions";
import { initialActionState } from "@/lib/action-state";

export function LoginForm({ next }: { next: string | null }) {
  const [state, formAction, isPending] = useActionState(loginAction, initialActionState);

  return (
    <form action={formAction} className="mt-8 space-y-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}

      <label className="block">
        <span className="text-sm font-semibold">メールアドレス</span>
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          className="mt-2 w-full rounded-2xl border border-line px-4 py-3 outline-none focus:border-accent"
        />
      </label>

      <label className="block">
        <span className="text-sm font-semibold">パスワード</span>
        <input
          type="password"
          name="password"
          required
          autoComplete="current-password"
          className="mt-2 w-full rounded-2xl border border-line px-4 py-3 outline-none focus:border-accent"
        />
      </label>

      {state.error ? (
        <p
          role="alert"
          className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
        >
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-2xl bg-ink px-6 py-4 text-base font-bold text-white disabled:opacity-60"
      >
        {isPending ? "確認中..." : "ログイン"}
      </button>
    </form>
  );
}
