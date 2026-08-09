import Link from "next/link";

import { listPublishedLocations } from "@/server/parking";

export const dynamic = "force-dynamic";

/**
 * トップページ。
 *
 * §29 のとおり検索は主役ではない。ここは PITTO を知るための入口と、
 * 設置済み駐輪場の確認用に留めていて、利用開始の導線はあくまで現地のQR。
 */
export default async function HomePage() {
  const locations = await listPublishedLocations();

  return (
    <main className="flex flex-1 flex-col px-5 pb-10 pt-8">
      <p className="text-sm font-semibold tracking-widest text-accent">PITTO</p>
      <h1 className="mt-2 text-3xl font-bold leading-snug">
        空いている場所に、
        <br />
        その場でサッと停める。
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-ink-soft">
        予約なし、アプリなし、駐輪機なし。
        <br />
        現地のQRを読むだけで利用できます。
      </p>

      <section className="mt-8">
        <h2 className="text-sm font-bold">設置済みのPITTO</h2>

        {locations.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-line p-5 text-sm text-ink-soft">
            まだ駐輪場が登録されていません。<code>npm run db:seed</code> でデモデータを作成できます。
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {locations.map((location) => (
              <li key={location.id}>
                <Link
                  href={`/l/${location.id}`}
                  className="block rounded-3xl border border-line p-5 active:bg-surface"
                >
                  <p className="font-bold">{location.name}</p>
                  <p className="mt-1 text-xs text-ink-soft">{location.address}</p>

                  <div className="mt-3 flex items-end justify-between">
                    <div>
                      {/* §17 「満空情報」とは言わない。現地とズレる前提の表示にする。 */}
                      <p className="text-xs text-ink-soft">システム上の空き</p>
                      <p className="text-lg font-bold">
                        {location.accepting ? `${location.systemFreeSpaces}区画` : "受付停止中"}
                        <span className="ml-1 text-xs font-medium text-ink-soft">
                          / 全{location.totalSpaces}区画
                        </span>
                      </p>
                    </div>
                    <p className="text-right text-sm font-semibold">
                      {location.rule.baseMinutes}分{location.rule.basePriceJpy}円
                      <span className="block text-xs font-medium text-ink-soft">
                        24時間最大{location.rule.dailyCapJpy}円
                      </span>
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="mt-8 rounded-2xl bg-surface p-4 text-xs leading-relaxed text-ink-soft">
        表示は登録情報にもとづくもので、現地の状況と異なる場合があります。
        センサーによる満空検知は行っていません。
      </p>
    </main>
  );
}
