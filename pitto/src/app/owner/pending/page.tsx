import { ConsoleShell } from "@/components/console";
import { getAccount } from "@/server/auth";

export const dynamic = "force-dynamic";

const MESSAGE: Record<string, { title: string; body: string }> = {
  PENDING_REVIEW: {
    title: "審査中です",
    body: "ご登録の内容をPITTO運営で確認しています。公開までもうしばらくお待ちください。",
  },
  SUSPENDED: {
    title: "現在ご利用いただけません",
    body: "アカウントが停止されています。心当たりがない場合はPITTO運営までご連絡ください。",
  },
};

/** §20 完全自動公開にはしないため、審査待ちのオーナーはここで止まる。 */
export default async function OwnerPendingPage() {
  const account = await getAccount();
  const message = MESSAGE[account?.ownerStatus ?? ""] ?? {
    title: "オーナー登録がありません",
    body: "スペースの登録をご希望の場合はPITTO運営までご連絡ください。",
  };

  return (
    <ConsoleShell title="オーナー">
      <div className="rounded-3xl border border-line bg-white p-8">
        <h1 className="text-xl font-bold">{message.title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">{message.body}</p>
      </div>
    </ConsoleShell>
  );
}
