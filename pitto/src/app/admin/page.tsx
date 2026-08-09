import Link from "next/link";

import { ConsoleShell, Section, StatTile } from "@/components/console";
import { formatYen } from "@/lib/pricing";
import { getAdminOverview, LONG_SESSION_HOURS } from "@/server/admin";
import { requireStaff } from "@/server/auth";

import { ADMIN_NAV } from "./nav";

export const dynamic = "force-dynamic";

/** §27 概要。まず「今なにを見るべきか」が分かることを優先する。 */
export default async function AdminPage() {
  await requireStaff();
  const overview = await getAdminOverview();

  const todo = [
    {
      href: "/admin/owners",
      label: "オーナーの審査",
      count: overview.ownersPendingReview,
    },
    {
      href: "/admin/locations",
      label: "駐輪場の審査",
      count: overview.locationsPendingReview,
    },
    {
      href: "/admin/incidents",
      label: "未対応のトラブル報告",
      count: overview.openIncidents,
    },
    {
      href: "/admin/sessions?filter=long",
      label: `${LONG_SESSION_HOURS}時間を超える利用`,
      count: overview.longRunningSessions,
    },
    {
      href: "/admin/locations",
      label: "確認中の区画",
      count: overview.flaggedSpaces,
    },
  ];

  return (
    <ConsoleShell title="管理" nav={[...ADMIN_NAV]}>
      <Section title="要対応">
        <ul className="divide-y divide-line overflow-hidden rounded-3xl border border-line bg-white">
          {todo.map((item) => (
            <li key={item.label}>
              <Link
                href={item.href}
                className="flex items-center justify-between px-5 py-4 hover:bg-surface"
              >
                <span className="text-sm font-semibold">{item.label}</span>
                <span
                  className={`text-lg font-bold ${item.count > 0 ? "text-accent" : "text-ink-soft"}`}
                >
                  {item.count}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="いまの状況">
        <div className="grid gap-4 sm:grid-cols-3">
          <StatTile label="利用中" value={`${overview.activeSessions}件`} />
          <StatTile label="本日の売上" value={formatYen(overview.todayRevenueJpy)} note="手数料を引く前" />
          <StatTile label="今月の売上" value={formatYen(overview.monthRevenueJpy)} note="手数料を引く前" />
        </div>
      </Section>

      <p className="mt-8 rounded-2xl bg-white p-4 text-xs leading-relaxed text-ink-soft">
        売上は利用終了時に確定した金額の合計です。決済・手数料・オーナー報酬・返金の管理は、
        Stripeを組み込むPhase 2で追加します。
      </p>
    </ConsoleShell>
  );
}
