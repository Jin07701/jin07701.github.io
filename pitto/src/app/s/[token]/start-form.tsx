"use client";

import { useActionState } from "react";

import { startParkingAction } from "@/app/actions";
import { initialActionState } from "@/lib/action-state";

export function StartForm({ token }: { token: string }) {
  const [state, formAction, isPending] = useActionState(startParkingAction, initialActionState);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="token" value={token} />

      {state.error ? (
        <p
          role="alert"
          className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
        >
          {state.error}
        </p>
      ) : null}

      {/* §36 大きなボタン。迷わせない。 */}
      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded-2xl bg-accent px-6 py-5 text-lg font-bold text-white transition-colors active:bg-accent-strong disabled:opacity-60"
      >
        {isPending ? "処理中..." : "この区画を利用する"}
      </button>
    </form>
  );
}
