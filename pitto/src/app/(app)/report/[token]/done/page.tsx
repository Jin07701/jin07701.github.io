import Link from "next/link";

export default async function ReportDonePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  return (
    <main className="flex flex-1 flex-col px-5 pb-8 pt-16 text-center">
      <h1 className="text-3xl font-bold">報告を受け付けました</h1>
      <p className="mt-4 text-sm leading-relaxed text-ink-soft">
        内容を運営で確認します。
        <br />
        区画の状態はその場では変わりません。
      </p>

      <Link
        href={`/s/${token}`}
        className="mt-auto rounded-2xl border border-line px-6 py-4 text-sm font-semibold"
      >
        区画の画面に戻る
      </Link>
    </main>
  );
}
