/**
 * 利用者フローの枠。
 * §36 スマホファースト。広い画面でも横に広げず、中央の1カラムに収める。
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-white shadow-sm">
      {children}
    </div>
  );
}
