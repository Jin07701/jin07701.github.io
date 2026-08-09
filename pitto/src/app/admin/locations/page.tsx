import { ConsoleShell, Pill } from "@/components/console";
import { listLocations } from "@/server/admin";
import { requireStaff } from "@/server/auth";

import { setLocationStatusAction } from "../actions";
import { ADMIN_NAV, LOCATION_STATUS_LABEL } from "../nav";

export const dynamic = "force-dynamic";

/** §27 駐輪場: 申請 / 審査 / 公開 / 非公開 / 強制停止 */
export default async function AdminLocationsPage() {
  await requireStaff();
  const locations = await listLocations();

  return (
    <ConsoleShell
      title="管理"
      nav={[...ADMIN_NAV]}
      subtitle="§20 完全自動公開はしない。内容を確認してから公開する。"
    >
      <ul className="space-y-3">
        {locations.map((location) => (
          <li key={location.id} className="rounded-3xl border border-line bg-white p-5">
            <div className="flex flex-wrap items-start gap-3">
              <div className="min-w-0">
                <p className="font-bold">{location.name}</p>
                <p className="mt-1 text-xs text-ink-soft">{location.address}</p>
                <p className="mt-1 text-xs text-ink-soft">オーナー: {location.ownerName}</p>
              </div>

              <div className="ml-auto flex flex-wrap items-center gap-2">
                <Pill
                  tone={
                    location.status === "PUBLISHED"
                      ? "done"
                      : location.status === "PENDING_REVIEW"
                        ? "warn"
                        : "neutral"
                  }
                >
                  {LOCATION_STATUS_LABEL[location.status]}
                </Pill>
                <Pill tone={location.accepting ? "active" : "neutral"}>
                  {location.accepting ? "受付中" : "停止"}
                </Pill>
              </div>
            </div>

            <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
              <div>
                <dt className="text-xs text-ink-soft">区画</dt>
                <dd className="font-bold">{location.totalSpaces}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-soft">利用中</dt>
                <dd className="font-bold">{location.activeSpaces}</dd>
              </div>
              <div>
                <dt className="text-xs text-ink-soft">確認中</dt>
                <dd className={`font-bold ${location.flaggedSpaces > 0 ? "text-amber-700" : ""}`}>
                  {location.flaggedSpaces}
                </dd>
              </div>
            </dl>

            <div className="mt-4 flex flex-wrap gap-2">
              {location.status !== "PUBLISHED" ? (
                <form action={setLocationStatusAction}>
                  <input type="hidden" name="locationId" value={location.id} />
                  <input type="hidden" name="status" value="PUBLISHED" />
                  <button
                    type="submit"
                    className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white"
                  >
                    公開する
                  </button>
                </form>
              ) : (
                <form action={setLocationStatusAction}>
                  <input type="hidden" name="locationId" value={location.id} />
                  <input type="hidden" name="status" value="DRAFT" />
                  <button
                    type="submit"
                    className="rounded-xl border border-line px-4 py-2 text-sm font-semibold"
                  >
                    非公開にする
                  </button>
                </form>
              )}

              {location.status !== "SUSPENDED" ? (
                <form action={setLocationStatusAction}>
                  <input type="hidden" name="locationId" value={location.id} />
                  <input type="hidden" name="status" value="SUSPENDED" />
                  <button
                    type="submit"
                    className="rounded-xl border border-line px-4 py-2 text-sm font-semibold hover:border-red-300 hover:text-red-700"
                  >
                    強制停止する
                  </button>
                </form>
              ) : null}
            </div>

            <p className="mt-3 text-xs text-ink-soft">
              停止しても、進行中の利用は利用者が終了できます。
            </p>
          </li>
        ))}
      </ul>
    </ConsoleShell>
  );
}
