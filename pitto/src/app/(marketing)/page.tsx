import Link from "next/link";

/** 利用者の導線は3手で終わる(§6・§8)。 */
const USER_STEPS = [
  {
    step: "1",
    title: "空いている区画を見つける",
    body: "歩いている途中で見つけたら、それが使いどきです。探してから出かける必要はありません。",
  },
  {
    step: "2",
    title: "区画のQRを読む",
    body: "ブラウザが開きます。アプリのインストールは必要ありません。",
  },
  {
    step: "3",
    title: "そのまま停める",
    body: "［この区画を利用する］を押すだけ。終わったら［利用を終了する］で完了です。",
  },
] as const;

/** §5 PITTOが持たないもの。持たないことが価値になる。 */
const WITHOUT = [
  { title: "予約なし", body: "未来の場所を確保するサービスではありません。今ここに停めるためのものです。" },
  { title: "アプリなし", body: "QRからブラウザが開くだけ。インストールもログインの手間もありません。" },
  { title: "駐輪機なし", body: "電磁ロックもゲートも精算機も使いません。区画とQRだけで成立します。" },
] as const;

/** §18 オーナーに伝える価値は「駐輪場経営」ではなく「余っている3㎡」。 */
const OWNER_SPACES = [
  "個人宅の軒先",
  "店舗の横",
  "ビルのデッドスペース",
  "マンションの前",
  "月極駐車場の余り",
  "空きテナント",
  "会社の敷地",
  "建替え待ちの土地",
] as const;

const OWNER_POINTS = [
  {
    title: "設備投資はいりません",
    body: "必要なのは区画の番号とQRの掲示だけ。機械を買う必要はありません。",
  },
  {
    title: "1台分から登録できます",
    body: "3㎡ほどの空きがあれば十分です。1〜20台程度の小さなスペースを想定しています。",
  },
  {
    title: "日々の管理はいりません",
    body: "貸出日の設定も予約の管理も、利用者との連絡もありません。受付の停止はスイッチひとつです。",
  },
] as const;

export default function MarketingPage() {
  return (
    <main>
      {/* ヒーロー */}
      <section className="mx-auto max-w-5xl px-5 pb-16 pt-12 sm:pt-20">
        <p className="text-sm font-semibold tracking-widest text-accent">
          予約不要・設備不要のマイクロ駐輪場
        </p>
        <h1 className="mt-4 text-4xl font-bold leading-tight sm:text-6xl">
          空いている場所に、
          <br />
          その場でサッと停める。
        </h1>
        <p className="mt-5 max-w-xl text-base leading-relaxed text-ink-soft sm:text-lg">
          自転車を停めたくなるのは、目的地に着いたそのときです。
          PITTOは、街の小さな空きスペースをそのまま駐輪場に変えて、
          見つけたらすぐ使える状態にします。
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/spots"
            className="rounded-2xl bg-accent px-7 py-4 text-base font-bold text-white active:bg-accent-strong"
          >
            設置場所を見る
          </Link>
          <a
            href="#owner"
            className="rounded-2xl border border-line px-7 py-4 text-base font-bold text-ink"
          >
            スペースを貸したい方へ
          </a>
        </div>
      </section>

      {/* 利用者の3ステップ */}
      <section className="border-y border-line bg-surface">
        <div className="mx-auto max-w-5xl px-5 py-16">
          <h2 className="text-2xl font-bold sm:text-3xl">停めるまで、3ステップ。</h2>
          <p className="mt-3 text-sm text-ink-soft">
            目標はQRを読んでから30秒以内に停め終わることです。
          </p>

          <ol className="mt-8 grid gap-5 sm:grid-cols-3">
            {USER_STEPS.map((item) => (
              <li key={item.step} className="rounded-3xl border border-line bg-white p-6">
                <span className="inline-flex size-9 items-center justify-center rounded-full bg-accent text-base font-bold text-white">
                  {item.step}
                </span>
                <h3 className="mt-4 text-lg font-bold">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">{item.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 省いたもの */}
      <section className="mx-auto max-w-5xl px-5 py-16">
        <h2 className="text-2xl font-bold sm:text-3xl">足すのではなく、省きました。</h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-soft">
          自転車を停めるだけの用事に、検索も比較も日時の入力も必要ありません。
          PITTOは機能を増やすより、利用開始までを短くすることを優先しています。
        </p>

        <div className="mt-8 grid gap-5 sm:grid-cols-3">
          {WITHOUT.map((item) => (
            <div key={item.title} className="rounded-3xl border border-line p-6">
              <h3 className="text-lg font-bold">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 料金 */}
      <section className="border-y border-line bg-surface">
        <div className="mx-auto max-w-5xl px-5 py-16">
          <h2 className="text-2xl font-bold sm:text-3xl">料金は、その場に書いてあるだけ。</h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-soft">
            料金は駐輪場ごとに決まっていて、QRを読んだ画面に大きく表示されます。
            会員ランクも時間帯別の変動もありません。
          </p>

          <div className="mt-8 inline-flex flex-wrap items-end gap-x-10 gap-y-4 rounded-3xl border border-line bg-white px-8 py-6">
            <div>
              <p className="text-xs text-ink-soft">たとえば</p>
              <p className="text-3xl font-bold">
                60分<span className="text-accent">100円</span>
              </p>
            </div>
            <div>
              <p className="text-xs text-ink-soft">24時間最大</p>
              <p className="text-3xl font-bold">500円</p>
            </div>
          </div>
          <p className="mt-4 text-xs text-ink-soft">
            金額は一例です。実際の料金は各駐輪場の表示をご確認ください。
          </p>
        </div>
      </section>

      {/* オーナー向け */}
      <section id="owner" className="mx-auto max-w-5xl px-5 py-16">
        <p className="text-sm font-semibold tracking-widest text-accent">スペースをお持ちの方へ</p>
        <h2 className="mt-3 text-2xl font-bold leading-snug sm:text-4xl">
          駐輪場を経営しなくて大丈夫です。
          <br />
          余っている3㎡を貸してください。
        </h2>
        <p className="mt-5 max-w-2xl text-sm leading-relaxed text-ink-soft">
          使っていない数㎡があれば、その日から小さなコイン駐輪場になります。
          工事も機械もいりません。区画に番号を振って、PITTOが発行するQRを貼るだけです。
        </p>

        <ul className="mt-8 flex flex-wrap gap-2">
          {OWNER_SPACES.map((space) => (
            <li
              key={space}
              className="rounded-full border border-line px-4 py-2 text-sm text-ink-soft"
            >
              {space}
            </li>
          ))}
        </ul>

        <div className="mt-10 grid gap-5 sm:grid-cols-3">
          {OWNER_POINTS.map((item) => (
            <div key={item.title} className="rounded-3xl border border-line bg-surface p-6">
              <h3 className="text-lg font-bold">{item.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{item.body}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 rounded-3xl border border-line p-6">
          <h3 className="text-lg font-bold">登録の前に確認させていただくこと</h3>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            そのスペースを駐輪場として提供する権限があるかどうかを、登録時にご確認いただきます。
            所有者ご本人でない場合は、所有者または管理会社の許可が必要です。
            公開前にPITTO運営で内容を確認するため、登録後すぐに公開されるわけではありません。
          </p>
          <Link
            href="/login"
            className="mt-5 inline-block rounded-2xl bg-ink px-7 py-4 text-base font-bold text-white"
          >
            オーナー画面にログイン
          </Link>
        </div>
      </section>
    </main>
  );
}
