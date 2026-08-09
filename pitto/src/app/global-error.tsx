"use client";

/** ルートレイアウトごと落ちたときの受け皿。html/body は自前で持つ必要がある。 */
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="ja">
      <body className="font-sans antialiased">
        <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-6 bg-white px-5 text-center">
          <h1 className="text-2xl font-bold">問題が発生しました</h1>
          <p className="text-sm text-ink-soft">
            通信状況を確認して、もう一度お試しください。
            <br />
            ご利用中の場合、料金の計算は続いています。
          </p>
          <button
            type="button"
            onClick={reset}
            className="w-full rounded-2xl bg-ink px-6 py-4 text-lg font-bold text-white"
          >
            再読み込み
          </button>
        </main>
      </body>
    </html>
  );
}
