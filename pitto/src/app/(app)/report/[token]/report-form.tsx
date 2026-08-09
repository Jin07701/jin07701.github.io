"use client";

import { useActionState } from "react";

import { submitIncidentAction } from "@/app/actions";
import { initialActionState } from "@/lib/action-state";

const OPTIONS = [
  {
    value: "SPACE_ACTUALLY_FREE",
    label: "利用中と出ているが、実際は空いている",
    hint: "前の利用者が終了を押し忘れている可能性があります。",
  },
  {
    value: "UNAUTHORIZED_PARKING",
    label: "空きと出ているが、自転車が停まっている",
    hint: "無断駐輪の可能性があります。",
  },
] as const;

export function ReportForm({ token }: { token: string }) {
  const [state, formAction, isPending] = useActionState(submitIncidentAction, initialActionState);

  return (
    <form action={formAction} className="mt-6 flex flex-1 flex-col">
      <input type="hidden" name="token" value={token} />

      <fieldset className="space-y-3">
        <legend className="sr-only">報告の種類</legend>
        {OPTIONS.map((option, index) => (
          <label
            key={option.value}
            className="flex cursor-pointer gap-3 rounded-2xl border border-line p-4 has-checked:border-accent has-checked:bg-accent/5"
          >
            <input
              type="radio"
              name="type"
              value={option.value}
              defaultChecked={index === 0}
              className="mt-1 size-5 accent-accent"
            />
            <span>
              <span className="block font-semibold">{option.label}</span>
              <span className="mt-0.5 block text-xs text-ink-soft">{option.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <label className="mt-5 block">
        <span className="text-sm font-semibold">補足(任意)</span>
        <textarea
          name="note"
          rows={3}
          maxLength={500}
          className="mt-2 w-full rounded-2xl border border-line p-4 text-sm outline-none focus:border-accent"
          placeholder="状況を簡単に教えてください"
        />
      </label>

      {/* §16 の写真添付は Supabase Storage を入れる Phase 5 で追加する。 */}
      <p className="mt-3 text-xs text-ink-soft">写真の添付は今後のアップデートで対応します。</p>

      <div className="mt-auto space-y-3 pt-8">
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
          className="w-full rounded-2xl bg-ink px-6 py-5 text-lg font-bold text-white transition-opacity active:opacity-80 disabled:opacity-60"
        >
          {isPending ? "送信中..." : "報告する"}
        </button>
      </div>
    </form>
  );
}
