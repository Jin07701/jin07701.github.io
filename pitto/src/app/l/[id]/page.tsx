import Link from "next/link";
import { notFound } from "next/navigation";

import { findLocationWithSpaces } from "@/server/parking";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  FREE: "空き",
  ACTIVE: "利用中",
  FLAGGED: "確認中",
};

/**
 * 駐輪場の区画一覧とQR。
 *
 * §23 のQRセット配布(A4 PDF)は Phase 3 のオーナー画面で用意する。
 * ここではブラウザから印刷できる形で区画ごとのQRを並べている。
 */
export default async function LocationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const location = await findLocationWithSpaces(id);
  if (!location) notFound();

  return (
    <main className="flex flex-1 flex-col px-5 pb-10 pt-6">
      <Link href="/" className="text-sm font-semibold text-accent">
        ← PITTOトップ
      </Link>

      <h1 className="mt-3 text-2xl font-bold leading-snug">{location.name}</h1>
      <p className="mt-1 text-sm text-ink-soft">{location.address}</p>
      <p className="mt-3 text-sm font-semibold">
        {location.rule.baseMinutes}分{location.rule.basePriceJpy}円 / 24時間最大
        {location.rule.dailyCapJpy}円
      </p>

      <ul className="mt-6 space-y-4">
        {location.spaces.map((space) => (
          <li key={space.id} className="rounded-3xl border border-line p-5 text-center">
            <div className="flex items-baseline justify-between text-left">
              <div>
                <p className="text-xs text-ink-soft">区画</p>
                <p className="text-3xl font-bold leading-none">{space.spaceNumber}</p>
              </div>
              <p className="text-sm font-semibold text-ink-soft">
                {STATUS_LABEL[space.status] ?? space.status}
              </p>
            </div>

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/api/qr/${space.qrToken}`}
              alt={`区画${space.spaceNumber}のQRコード`}
              width={192}
              height={192}
              className="mx-auto mt-4 size-48"
            />

            <Link
              href={`/s/${space.qrToken}`}
              className="mt-3 inline-block text-sm font-semibold text-accent"
            >
              この区画の画面を開く
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
