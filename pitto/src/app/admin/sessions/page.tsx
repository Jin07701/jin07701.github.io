import Link from "next/link";

import { ConsoleShell, Pill } from "@/components/console";
import { elapsedMinutes, formatDuration, formatYen } from "@/lib/pricing";
import { listSessions, LONG_SESSION_HOURS } from "@/server/admin";
import { requireStaff } from "@/server/auth";

import { forceEndSessionAction } from "../actions";
import { ADMIN_NAV, formatDateTime, SESSION_STATUS_LABEL } from "../nav";

export const dynamic = "force-dynamic";

const FILTERS = [
  { value: "open", label: "利用中" },
  { value: "long", label: `${LONG_SESSION_HOURS}時間超` },
  { value: "all", label: "すべて" },
] as const;

type Filter = (typeof FILTERS)[number]["value"];

/** §27 利用: 利用中 / 完了 / 長時間利用 */
export default async function AdminSessionsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  await requireStaff();

  const { filter } = await searchParams;
  const active: Filter = FILTERS.some((item) => item.value === filter)
    ? (filter as Filter)
    : "open";

  const sessions = await listSessions(active);
  const now = new Date();

  return (
    <ConsoleShell title="管理" nav={[...ADMIN_NAV]}>
      <div className="flex gap-2">
        {FILTERS.map((item) => (
          <Link
            key={item.value}
            href={`/admin/sessions?filter=${item.value}`}
            className={`rounded-xl px-4 py-2 text-sm font-semibold ${
              item.value === active ? "bg-ink text-white" : "border border-line bg-white"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </div>

      {sessions.length === 0 ? (
        <p className="mt-6 rounded-3xl border border-line bg-white p-6 text-sm text-ink-soft">
          該当する利用はありません。
        </p>
      ) : (
        <ul className="mt-6 space-y-2">
          {sessions.map((session) => {
            const isOpen = !session.endedAt;

            return (
              <li
                key={session.id}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-line bg-white px-5 py-4 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-semibold">
                    {session.locationName} <span className="text-ink-soft">区画{session.spaceNumber}</span>
                  </p>
                  <p className="mt-0.5 text-xs text-ink-soft">
                    {formatDateTime(session.startedAt)} 開始
                  </p>
                </div>

                <div className="ml-auto flex flex-wrap items-center gap-3">
                  <span className="font-semibold">
                    {formatDuration(elapsedMinutes(session.startedAt, session.endedAt ?? now))}
                  </span>
                  <span className="font-semibold">
                    {session.amountJpy === null ? "—" : formatYen(session.amountJpy)}
                  </span>

                  {session.isLongRunning ? <Pill tone="warn">長時間</Pill> : null}
                  <Pill tone={isOpen ? "active" : "done"}>
                    {SESSION_STATUS_LABEL[session.status] ?? session.status}
                  </Pill>

                  {/* §14 出庫忘れで開きっぱなしのものを運営が閉じる。 */}
                  {isOpen ? (
                    <form action={forceEndSessionAction}>
                      <input type="hidden" name="sessionId" value={session.id} />
                      <button
                        type="submit"
                        className="rounded-xl border border-line px-3 py-1.5 text-xs font-semibold hover:border-accent hover:text-accent"
                      >
                        強制終了
                      </button>
                    </form>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-8 rounded-2xl bg-white p-4 text-xs leading-relaxed text-ink-soft">
        強制終了もサーバー時刻で料金を確定させ、操作履歴を audit_logs に残します。
        未払い・返金の管理は決済機能の導入後に追加します。
      </p>
    </ConsoleShell>
  );
}
