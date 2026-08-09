import Link from "next/link";

/** サービス紹介ページの枠。利用者フローと違い、横幅を使ってよい。 */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-white">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
        <Link href="/" className="text-lg font-bold tracking-widest text-accent">
          PITTO
        </Link>
        <nav className="flex items-center gap-4 text-sm font-semibold">
          <Link href="/spots" className="text-ink-soft hover:text-ink">
            設置場所
          </Link>
          <Link href="/login" className="text-ink-soft hover:text-ink">
            ログイン
          </Link>
        </nav>
      </header>

      {children}

      <footer className="mt-20 border-t border-line">
        <div className="mx-auto max-w-5xl px-5 py-10 text-xs leading-relaxed text-ink-soft">
          <p className="font-semibold text-ink">PITTO(ピット)</p>
          <p className="mt-2">
            名称は仮称です。商標・ドメインの確認前のため変更となる場合があります。
          </p>
          <p className="mt-2">
            区画の空き状況はシステム上の登録情報にもとづくもので、センサーによる検知は行っていません。
            現地の状況と異なる場合があります。
          </p>
        </div>
      </footer>
    </div>
  );
}
