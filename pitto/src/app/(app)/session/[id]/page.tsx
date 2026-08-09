import { notFound, redirect } from "next/navigation";

import { getCurrentUserId } from "@/server/identity";
import { findSession } from "@/server/parking";

import { SessionLive } from "./session-live";

export const dynamic = "force-dynamic";

/** §12 利用中画面。画面上部に 場所・区画・料金 を常に出す(§36)。 */
export default async function SessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [session, userId] = await Promise.all([findSession(id), getCurrentUserId()]);
  if (!session) notFound();
  if (session.userId !== userId) notFound();

  if (session.status === "COMPLETED") {
    redirect(`/session/${id}/done`);
  }

  return (
    <main className="flex flex-1 flex-col px-5 pb-8 pt-6">
      <p className="inline-flex w-fit rounded-full bg-accent px-4 py-1.5 text-sm font-bold text-white">
        利用中
      </p>

      <h1 className="mt-4 text-2xl font-bold leading-snug">{session.locationName}</h1>
      <p className="mt-1 text-sm text-ink-soft">{session.locationAddress}</p>

      <div className="mt-5 flex items-center gap-4 rounded-3xl border border-line bg-surface px-5 py-4">
        <div>
          <p className="text-xs text-ink-soft">区画</p>
          <p className="text-4xl font-bold leading-none">{session.spaceNumber}</p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-xs text-ink-soft">料金</p>
          <p className="text-sm font-semibold">
            {session.rule.baseMinutes}分{session.rule.basePriceJpy}円
          </p>
          <p className="text-xs text-ink-soft">24時間最大{session.rule.dailyCapJpy}円</p>
        </div>
      </div>

      <SessionLive
        sessionId={session.id}
        startedAtIso={session.startedAt.toISOString()}
        rule={session.rule}
      />
    </main>
  );
}
