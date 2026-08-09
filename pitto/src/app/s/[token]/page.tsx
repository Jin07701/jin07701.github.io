import Link from "next/link";
import { notFound } from "next/navigation";

import { formatYen } from "@/lib/pricing";
import { assertSpaceIsUsable, findSpaceByToken, ParkingError } from "@/server/parking";

import { StartForm } from "./start-form";

export const dynamic = "force-dynamic";

/**
 * 区画QRの着地ページ。§8 の画面。
 *
 * ここが PITTO の最重要導線なので、表示するのは
 * 「どこか」「どの区画か」「いくらか」「使うボタン」だけに絞る。
 */
export default async function SpacePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const space = await findSpaceByToken(token);

  if (!space) notFound();

  let blockedReason: string | null = null;
  try {
    assertSpaceIsUsable(space, new Date());
  } catch (error) {
    if (!(error instanceof ParkingError)) throw error;
    blockedReason = error.message;
  }

  return (
    <main className="flex flex-1 flex-col px-5 pb-8 pt-6">
      <p className="text-sm font-semibold tracking-widest text-accent">PITTO</p>
      <h1 className="mt-1 text-2xl font-bold leading-snug">{space.locationName}</h1>
      <p className="mt-1 text-sm text-ink-soft">{space.locationAddress}</p>

      <div className="mt-6 rounded-3xl border border-line bg-surface p-6 text-center">
        <p className="text-sm font-medium text-ink-soft">区画</p>
        <p className="mt-1 text-6xl font-bold tracking-tight">{space.spaceNumber}</p>
      </div>

      <dl className="mt-5 space-y-3 rounded-3xl border border-line p-5">
        <div className="flex items-baseline justify-between">
          <dt className="text-sm text-ink-soft">料金</dt>
          <dd className="text-xl font-bold">
            {space.rule.baseMinutes}分{formatYen(space.rule.basePriceJpy)}
          </dd>
        </div>
        <div className="flex items-baseline justify-between">
          <dt className="text-sm text-ink-soft">24時間最大</dt>
          <dd className="text-xl font-bold">{formatYen(space.rule.dailyCapJpy)}</dd>
        </div>
        {space.rule.graceMinutes > 0 ? (
          <p className="pt-1 text-xs text-ink-soft">
            利用開始から{space.rule.graceMinutes}分以内に終了した場合は無料です。
          </p>
        ) : null}
      </dl>

      <div className="mt-auto pt-8">
        {blockedReason ? (
          <div className="space-y-4">
            <p
              role="alert"
              className="rounded-2xl bg-amber-50 px-5 py-4 text-center text-sm font-medium text-amber-800"
            >
              {blockedReason}
            </p>
            {/* §16 システム上は利用中でも実際は空いていることがある。報告導線を必ず出す。 */}
            <Link
              href={`/report/${token}`}
              className="block rounded-2xl border border-line px-6 py-4 text-center text-sm font-semibold text-ink-soft"
            >
              実際の状況と違う場合は報告する
            </Link>
          </div>
        ) : (
          <StartForm token={token} />
        )}
      </div>
    </main>
  );
}
