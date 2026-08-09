import Link from "next/link";

import { logoutAction } from "@/app/auth-actions";

/** オーナー画面と管理画面で共通の枠。利用者画面とは別物として広く使う。 */
export function ConsoleShell({
  title,
  subtitle,
  nav,
  children,
}: {
  title: string;
  subtitle?: string;
  nav?: { href: string; label: string }[];
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-surface">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4">
          <Link href="/" className="text-base font-bold tracking-widest text-accent">
            PITTO
          </Link>
          <span className="text-sm font-semibold text-ink-soft">{title}</span>

          <form action={logoutAction} className="ml-auto">
            <button type="submit" className="text-sm font-semibold text-ink-soft hover:text-ink">
              ログアウト
            </button>
          </form>
        </div>

        {nav && nav.length > 0 ? (
          <nav className="mx-auto flex max-w-5xl gap-4 overflow-x-auto px-5 pb-3 text-sm font-semibold">
            {nav.map((item) => (
              <Link key={item.href} href={item.href} className="whitespace-nowrap text-ink-soft hover:text-ink">
                {item.label}
              </Link>
            ))}
          </nav>
        ) : null}
      </header>

      <main className="mx-auto max-w-5xl px-5 py-8">
        {subtitle ? <p className="mb-6 text-sm text-ink-soft">{subtitle}</p> : null}
        {children}
      </main>
    </div>
  );
}

/** 数字をひとつだけ大きく見せるタイル。 */
export function StatTile({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="rounded-3xl border border-line bg-white p-5">
      <p className="text-xs font-medium text-ink-soft">{label}</p>
      <p className="mt-1 text-3xl font-bold">{value}</p>
      {note ? <p className="mt-1 text-xs text-ink-soft">{note}</p> : null}
    </div>
  );
}

const TONE_CLASS = {
  neutral: "bg-surface text-ink-soft",
  active: "bg-accent/10 text-accent",
  warn: "bg-amber-50 text-amber-800",
  done: "bg-emerald-50 text-emerald-700",
} as const;

export function Pill({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: keyof typeof TONE_CLASS;
}) {
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${TONE_CLASS[tone]}`}>
      {children}
    </span>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-sm font-bold">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}
