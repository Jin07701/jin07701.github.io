"use client";

import { useActionState, useEffect, useState } from "react";

import { endParkingAction } from "@/app/actions";
import { initialActionState } from "@/lib/action-state";
import {
  calculateFeeJpy,
  elapsedMinutes,
  formatDuration,
  formatYen,
  type PricingRule,
} from "@/lib/pricing";

type Props = {
  sessionId: string;
  startedAtIso: string;
  rule: PricingRule;
};

/**
 * §12 の利用中画面。
 *
 * ここに出す経過時間と料金は端末時計から計算した「目安」で、
 * 確定額は §13 のとおり終了時にサーバーが計算したものを使う。
 */
export function SessionLive({ sessionId, startedAtIso, rule }: Props) {
  const [state, formAction, isPending] = useActionState(endParkingAction, initialActionState);
  const startedAt = new Date(startedAtIso);

  // サーバーとクライアントで時刻がずれると hydration が壊れるため、初回描画では計算しない。
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const minutes = now ? elapsedMinutes(startedAt, now) : null;
  const amount = minutes === null ? null : calculateFeeJpy(minutes, rule);

  return (
    <>
      <dl className="mt-6 divide-y divide-line rounded-3xl border border-line">
        <div className="flex items-baseline justify-between px-5 py-4">
          <dt className="text-sm text-ink-soft">開始</dt>
          <dd className="text-xl font-bold">
            {startedAt.toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" })}
          </dd>
        </div>
        <div className="flex items-baseline justify-between px-5 py-4">
          <dt className="text-sm text-ink-soft">経過</dt>
          <dd className="text-xl font-bold">{minutes === null ? "—" : formatDuration(minutes)}</dd>
        </div>
        <div className="flex items-baseline justify-between px-5 py-4">
          <dt className="text-sm text-ink-soft">現在料金</dt>
          <dd className="text-3xl font-bold text-accent">
            {amount === null ? "—" : formatYen(amount)}
          </dd>
        </div>
      </dl>

      <p className="mt-3 text-xs text-ink-soft">
        表示は目安です。お支払い金額は利用終了時に確定します。
      </p>

      <form action={formAction} className="mt-auto space-y-3 pt-8">
        <input type="hidden" name="sessionId" value={sessionId} />

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
          {isPending ? "処理中..." : "利用を終了する"}
        </button>
      </form>
    </>
  );
}
