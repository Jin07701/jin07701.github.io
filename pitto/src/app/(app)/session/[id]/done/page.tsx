import Link from "next/link";
import { notFound } from "next/navigation";

import { elapsedMinutes, formatDuration, formatYen } from "@/lib/pricing";
import { getCurrentUserId } from "@/server/identity";
import { findSession } from "@/server/parking";

export const dynamic = "force-dynamic";

/** 完了画面。金額はサーバーが確定させた parking_sessions.amount_jpy をそのまま出す。 */
export default async function SessionDonePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [session, userId] = await Promise.all([findSession(id), getCurrentUserId()]);
  if (!session) notFound();
  if (session.userId !== userId) notFound();
  if (session.status !== "COMPLETED" || !session.endedAt || session.amountJpy === null) {
    notFound();
  }

  const minutes = elapsedMinutes(session.startedAt, session.endedAt);

  return (
    <main className="flex flex-1 flex-col px-5 pb-8 pt-10 text-center">
      <p className="text-sm font-semibold tracking-widest text-accent">PITTO</p>
      <h1 className="mt-3 text-3xl font-bold">利用が完了しました</h1>

      <div className="mt-8 rounded-3xl border border-line bg-surface px-6 py-8">
        <p className="text-sm text-ink-soft">お支払い金額</p>
        <p className="mt-2 text-5xl font-bold">{formatYen(session.amountJpy)}</p>
        {session.amountJpy === 0 ? (
          <p className="mt-3 text-xs text-ink-soft">無料時間内のため料金はかかりません。</p>
        ) : null}
      </div>

      <dl className="mt-6 divide-y divide-line rounded-3xl border border-line text-left">
        <div className="flex items-baseline justify-between px-5 py-4">
          <dt className="text-sm text-ink-soft">場所</dt>
          <dd className="font-semibold">{session.locationName}</dd>
        </div>
        <div className="flex items-baseline justify-between px-5 py-4">
          <dt className="text-sm text-ink-soft">区画</dt>
          <dd className="font-semibold">{session.spaceNumber}</dd>
        </div>
        <div className="flex items-baseline justify-between px-5 py-4">
          <dt className="text-sm text-ink-soft">利用時間</dt>
          <dd className="font-semibold">{formatDuration(minutes)}</dd>
        </div>
      </dl>

      <Link href="/" className="mt-auto pt-8 text-sm font-semibold text-accent">
        PITTOトップへ
      </Link>
    </main>
  );
}
