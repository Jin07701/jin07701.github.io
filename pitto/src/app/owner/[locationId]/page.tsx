import Link from "next/link";
import { notFound } from "next/navigation";

import { ConsoleShell, Pill, Section } from "@/components/console";
import { elapsedMinutes, formatDuration, formatYen } from "@/lib/pricing";
import { requireOwner } from "@/server/auth";
import { getOwnerLocationDetail } from "@/server/owner";

export const dynamic = "force-dynamic";

const INCIDENT_LABEL: Record<string, string> = {
  UNAUTHORIZED_PARKING: "無断駐輪",
  SPACE_ACTUALLY_FREE: "実際は空き",
  FORGOT_TO_END: "出庫忘れ",
  OTHER: "その他",
};

const INCIDENT_STATUS_LABEL: Record<string, string> = {
  OPEN: "未対応",
  IN_REVIEW: "確認中",
  RESOLVED: "対応済み",
  REJECTED: "却下",
};

function formatTime(value: Date): string {
  return value.toLocaleString("ja-JP", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tokyo",
  });
}

/** §25 詳細画面。区画・利用時間・売上・利用履歴・トラブル報告を1枚にまとめる。 */
export default async function OwnerLocationPage({
  params,
}: {
  params: Promise<{ locationId: string }>;
}) {
  const { locationId } = await params;
  const { ownerId } = await requireOwner();

  const detail = await getOwnerLocationDetail(ownerId, locationId);
  if (!detail) notFound();

  const now = new Date();
  const { location, spaces, sessions, incidents } = detail;

  return (
    <ConsoleShell title="オーナー">
      <Link href="/owner" className="text-sm font-semibold text-accent">
        ← ダッシュボード
      </Link>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">{location.name}</h1>
        <Pill tone={location.accepting ? "active" : "neutral"}>
          {location.accepting ? "受付中" : "停止"}
        </Pill>
      </div>
      <p className="mt-1 text-sm text-ink-soft">{location.address}</p>

      <Section title={`区画 (${spaces.length})`}>
        <ul className="grid gap-3 sm:grid-cols-2">
          {spaces.map((space) => (
            <li
              key={space.id}
              className="flex items-center gap-4 rounded-3xl border border-line bg-white p-4"
            >
              <div className="w-14 shrink-0">
                <p className="text-xs text-ink-soft">区画</p>
                <p className="text-2xl font-bold leading-none">{space.spaceNumber}</p>
              </div>

              <div className="min-w-0 flex-1">
                {space.status === "ACTIVE" && space.startedAt ? (
                  <>
                    <Pill tone="active">利用中</Pill>
                    <p className="mt-1 text-sm font-semibold">
                      {formatDuration(elapsedMinutes(space.startedAt, now))}経過
                    </p>
                    <p className="text-xs text-ink-soft">{formatTime(space.startedAt)}開始</p>
                  </>
                ) : space.status === "FLAGGED" ? (
                  <Pill tone="warn">確認中</Pill>
                ) : (
                  <Pill>空き</Pill>
                )}
              </div>

              {/* §23 QRセットのPDF配布は今後。まずは区画ごとのQR画像を出せるようにしている。 */}
              <a
                href={`/api/qr/${space.qrToken}`}
                target="_blank"
                rel="noreferrer"
                className="shrink-0 text-xs font-semibold text-accent"
              >
                QR
              </a>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="トラブル報告">
        {incidents.length === 0 ? (
          <p className="rounded-3xl border border-line bg-white p-5 text-sm text-ink-soft">
            報告はありません。
          </p>
        ) : (
          <ul className="space-y-2">
            {incidents.map((incident) => (
              <li
                key={incident.id}
                className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-white px-4 py-3 text-sm"
              >
                <Pill tone={incident.status === "OPEN" ? "warn" : "neutral"}>
                  {INCIDENT_STATUS_LABEL[incident.status] ?? incident.status}
                </Pill>
                <span className="font-semibold">
                  {INCIDENT_LABEL[incident.type] ?? incident.type}
                </span>
                {incident.spaceNumber ? (
                  <span className="text-ink-soft">区画{incident.spaceNumber}</span>
                ) : null}
                {incident.note ? (
                  <span className="min-w-0 flex-1 truncate text-ink-soft">{incident.note}</span>
                ) : null}
                <span className="ml-auto text-xs text-ink-soft">
                  {formatTime(incident.reportedAt)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="利用履歴">
        {sessions.length === 0 ? (
          <p className="rounded-3xl border border-line bg-white p-5 text-sm text-ink-soft">
            まだ利用がありません。
          </p>
        ) : (
          <div className="overflow-x-auto rounded-3xl border border-line bg-white">
            <table className="w-full min-w-[34rem] text-sm">
              <thead className="border-b border-line text-left text-xs text-ink-soft">
                <tr>
                  <th className="px-4 py-3 font-medium">区画</th>
                  <th className="px-4 py-3 font-medium">開始</th>
                  <th className="px-4 py-3 font-medium">利用時間</th>
                  <th className="px-4 py-3 font-medium">金額</th>
                  <th className="px-4 py-3 font-medium">状態</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => (
                  <tr key={session.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3 font-semibold">{session.spaceNumber}</td>
                    <td className="px-4 py-3 text-ink-soft">{formatTime(session.startedAt)}</td>
                    <td className="px-4 py-3">
                      {formatDuration(elapsedMinutes(session.startedAt, session.endedAt ?? now))}
                    </td>
                    <td className="px-4 py-3 font-semibold">
                      {session.amountJpy === null ? "—" : formatYen(session.amountJpy)}
                    </td>
                    <td className="px-4 py-3">
                      {session.status === "COMPLETED" ? (
                        <Pill tone="done">完了</Pill>
                      ) : (
                        <Pill tone="active">利用中</Pill>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </ConsoleShell>
  );
}
