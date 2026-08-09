import Link from "next/link";

import { toggleAcceptingAction } from "@/app/owner/actions";
import { ConsoleShell, Pill, Section, StatTile } from "@/components/console";
import { formatYen } from "@/lib/pricing";
import { requireOwner } from "@/server/auth";
import { getOwnerSummary } from "@/server/owner";

export const dynamic = "force-dynamic";

const LOCATION_STATUS_LABEL: Record<string, string> = {
  DRAFT: "下書き",
  PENDING_REVIEW: "審査中",
  PUBLISHED: "公開中",
  SUSPENDED: "停止中",
};

/**
 * §25 オーナーダッシュボード。
 * 最初の画面だけで 本日の売上 / 現在利用中 / 今月売上 / 受付状態 が分かるようにする。
 */
export default async function OwnerPage() {
  const { ownerId } = await requireOwner();
  const summary = await getOwnerSummary(ownerId);

  return (
    <ConsoleShell title="オーナー">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="本日の売上" value={formatYen(summary.todayRevenueJpy)} note="手数料を引く前" />
        <StatTile
          label="現在利用中"
          value={`${summary.activeSpaces}台`}
          note={`全${summary.totalSpaces}区画`}
        />
        <StatTile label="今月売上" value={formatYen(summary.monthRevenueJpy)} note="手数料を引く前" />
      </div>

      <Section title="駐輪場">
        {summary.locations.length === 0 ? (
          <p className="rounded-3xl border border-line bg-white p-6 text-sm text-ink-soft">
            登録された駐輪場がありません。
          </p>
        ) : (
          <ul className="space-y-3">
            {summary.locations.map((location) => (
              <li key={location.id} className="rounded-3xl border border-line bg-white p-5">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0">
                    <Link href={`/owner/${location.id}`} className="font-bold hover:text-accent">
                      {location.name}
                    </Link>
                    <p className="mt-1 text-xs text-ink-soft">{location.address}</p>
                  </div>

                  <div className="ml-auto flex items-center gap-2">
                    <Pill tone={location.status === "PUBLISHED" ? "done" : "warn"}>
                      {LOCATION_STATUS_LABEL[location.status] ?? location.status}
                    </Pill>
                    <Pill tone={location.accepting ? "active" : "neutral"}>
                      {location.accepting ? "受付中" : "停止"}
                    </Pill>
                  </div>
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                  <div>
                    <dt className="text-xs text-ink-soft">利用中</dt>
                    <dd className="font-bold">
                      {location.activeSpaces}台 / {location.totalSpaces}台
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-soft">本日</dt>
                    <dd className="font-bold">{formatYen(location.todayRevenueJpy)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-soft">今月</dt>
                    <dd className="font-bold">{formatYen(location.monthRevenueJpy)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-soft">未対応の報告</dt>
                    <dd className="font-bold">{location.openIncidents}件</dd>
                  </div>
                </dl>

                {/* §21 一時停止は受付中/停止のスイッチだけ。カレンダーは持たせない。 */}
                <form action={toggleAcceptingAction} className="mt-4">
                  <input type="hidden" name="locationId" value={location.id} />
                  <input type="hidden" name="accepting" value={String(!location.accepting)} />
                  <button
                    type="submit"
                    className="rounded-xl border border-line px-4 py-2 text-sm font-semibold hover:border-accent hover:text-accent"
                  >
                    {location.accepting ? "受付を停止する" : "受付を再開する"}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <p className="mt-8 rounded-2xl bg-white p-4 text-xs leading-relaxed text-ink-soft">
        売上は利用終了時に確定した金額の合計です。Stripeでの入金と手数料の明細は決済機能の導入後に表示します。
      </p>
    </ConsoleShell>
  );
}
