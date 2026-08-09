import { ConsoleShell, Pill } from "@/components/console";
import { listOwners } from "@/server/admin";
import { requireStaff } from "@/server/auth";

import { setOwnerStatusAction } from "../actions";
import { ADMIN_NAV, formatDateTime, OWNER_STATUS_LABEL } from "../nav";

export const dynamic = "force-dynamic";

/** §27 オーナー: 一覧 / 本人確認 / 承認 / 停止 */
export default async function AdminOwnersPage() {
  await requireStaff();
  const owners = await listOwners();

  return (
    <ConsoleShell
      title="管理"
      nav={[...ADMIN_NAV]}
      subtitle="§20 の権利確認に同意していないオーナーは承認しないでください。"
    >
      <ul className="space-y-3">
        {owners.map((owner) => (
          <li key={owner.id} className="rounded-3xl border border-line bg-white p-5">
            <div className="flex flex-wrap items-start gap-3">
              <div className="min-w-0">
                <p className="font-bold">{owner.displayName}</p>
                <p className="mt-1 text-xs text-ink-soft">{owner.contactEmail ?? "連絡先未登録"}</p>
              </div>
              <Pill
                tone={
                  owner.status === "APPROVED"
                    ? "done"
                    : owner.status === "PENDING_REVIEW"
                      ? "warn"
                      : "neutral"
                }
              >
                {OWNER_STATUS_LABEL[owner.status]}
              </Pill>
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              <div>
                <dt className="text-xs text-ink-soft">駐輪場</dt>
                <dd className="font-bold">{owner.locationCount}件</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-soft">提供権限の同意</dt>
                <dd className="font-bold">
                  {owner.rightsAcceptedAt ? formatDateTime(owner.rightsAcceptedAt) : "未同意"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-ink-soft">登録</dt>
                <dd className="font-bold">{formatDateTime(owner.createdAt)}</dd>
              </div>
            </dl>

            <div className="mt-4 flex flex-wrap gap-2">
              {owner.status !== "APPROVED" ? (
                <form action={setOwnerStatusAction}>
                  <input type="hidden" name="ownerId" value={owner.id} />
                  <input type="hidden" name="status" value="APPROVED" />
                  <button
                    type="submit"
                    disabled={!owner.rightsAcceptedAt}
                    className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
                  >
                    承認する
                  </button>
                </form>
              ) : null}

              {owner.status !== "SUSPENDED" ? (
                <form action={setOwnerStatusAction}>
                  <input type="hidden" name="ownerId" value={owner.id} />
                  <input type="hidden" name="status" value="SUSPENDED" />
                  <button
                    type="submit"
                    className="rounded-xl border border-line px-4 py-2 text-sm font-semibold hover:border-red-300 hover:text-red-700"
                  >
                    停止する
                  </button>
                </form>
              ) : (
                <form action={setOwnerStatusAction}>
                  <input type="hidden" name="ownerId" value={owner.id} />
                  <input type="hidden" name="status" value="PENDING_REVIEW" />
                  <button
                    type="submit"
                    className="rounded-xl border border-line px-4 py-2 text-sm font-semibold"
                  >
                    停止を解除する
                  </button>
                </form>
              )}
            </div>

            {!owner.rightsAcceptedAt ? (
              <p className="mt-3 text-xs text-amber-800">
                提供権限への同意がないため承認できません。
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </ConsoleShell>
  );
}
