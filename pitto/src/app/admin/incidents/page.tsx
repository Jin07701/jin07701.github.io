import Link from "next/link";

import { ConsoleShell, Pill } from "@/components/console";
import { listIncidents } from "@/server/admin";
import { requireStaff } from "@/server/auth";

import { setIncidentStatusAction } from "../actions";
import {
  ADMIN_NAV,
  formatDateTime,
  INCIDENT_STATUS_LABEL,
  INCIDENT_TYPE_LABEL,
} from "../nav";

export const dynamic = "force-dynamic";

/**
 * §27 トラブル: 無断駐輪 / 出庫忘れ / オーナー報告 / 利用者報告
 *
 * §15 のとおり報告だけで区画は解除しない。ここで運営が判断する。
 * 区画を空きに戻すのは「利用」画面の強制終了で行う。
 */
export default async function AdminIncidentsPage({
  searchParams,
}: {
  searchParams: Promise<{ all?: string }>;
}) {
  await requireStaff();

  const { all } = await searchParams;
  const onlyOpen = all !== "1";
  const incidents = await listIncidents(onlyOpen);

  return (
    <ConsoleShell title="管理" nav={[...ADMIN_NAV]}>
      <div className="flex gap-2">
        <Link
          href="/admin/incidents"
          className={`rounded-xl px-4 py-2 text-sm font-semibold ${
            onlyOpen ? "bg-ink text-white" : "border border-line bg-white"
          }`}
        >
          未対応
        </Link>
        <Link
          href="/admin/incidents?all=1"
          className={`rounded-xl px-4 py-2 text-sm font-semibold ${
            onlyOpen ? "border border-line bg-white" : "bg-ink text-white"
          }`}
        >
          すべて
        </Link>
      </div>

      {incidents.length === 0 ? (
        <p className="mt-6 rounded-3xl border border-line bg-white p-6 text-sm text-ink-soft">
          該当する報告はありません。
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {incidents.map((incident) => (
            <li key={incident.id} className="rounded-3xl border border-line bg-white p-5">
              <div className="flex flex-wrap items-center gap-3">
                <Pill tone={incident.status === "OPEN" ? "warn" : "neutral"}>
                  {INCIDENT_STATUS_LABEL[incident.status] ?? incident.status}
                </Pill>
                <span className="font-bold">
                  {INCIDENT_TYPE_LABEL[incident.type] ?? incident.type}
                </span>
                <span className="text-sm text-ink-soft">
                  {incident.locationName} 区画{incident.spaceNumber}
                </span>
                <span className="ml-auto text-xs text-ink-soft">
                  {formatDateTime(incident.reportedAt)}
                </span>
              </div>

              {incident.note ? (
                <p className="mt-3 rounded-2xl bg-surface px-4 py-3 text-sm">{incident.note}</p>
              ) : null}

              <p className="mt-3 text-xs text-ink-soft">
                現在の区画の状態: {incident.spaceStatus ?? "不明"}
                {incident.sessionId ? " / 進行中の利用あり" : ""}
              </p>

              {incident.status === "OPEN" || incident.status === "IN_REVIEW" ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {incident.status === "OPEN" ? (
                    <form action={setIncidentStatusAction}>
                      <input type="hidden" name="incidentId" value={incident.id} />
                      <input type="hidden" name="status" value="IN_REVIEW" />
                      <button
                        type="submit"
                        className="rounded-xl border border-line px-4 py-2 text-sm font-semibold"
                      >
                        確認中にする
                      </button>
                    </form>
                  ) : null}

                  <form action={setIncidentStatusAction}>
                    <input type="hidden" name="incidentId" value={incident.id} />
                    <input type="hidden" name="status" value="RESOLVED" />
                    <button
                      type="submit"
                      className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white"
                    >
                      対応済みにする
                    </button>
                  </form>

                  <form action={setIncidentStatusAction}>
                    <input type="hidden" name="incidentId" value={incident.id} />
                    <input type="hidden" name="status" value="REJECTED" />
                    <button
                      type="submit"
                      className="rounded-xl border border-line px-4 py-2 text-sm font-semibold"
                    >
                      却下する
                    </button>
                  </form>

                  {incident.sessionId ? (
                    <Link
                      href="/admin/sessions?filter=open"
                      className="rounded-xl border border-line px-4 py-2 text-sm font-semibold text-accent"
                    >
                      該当の利用を見る
                    </Link>
                  ) : null}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <p className="mt-8 rounded-2xl bg-white p-4 text-xs leading-relaxed text-ink-soft">
        報告を受けても区画の状態は自動では変わりません。空きに戻す必要がある場合は、
        「利用」画面から該当の利用を強制終了してください。写真の添付は今後対応します。
      </p>
    </ConsoleShell>
  );
}
