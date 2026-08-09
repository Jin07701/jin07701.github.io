import type { Metadata, Viewport } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "PITTO",
  description: "空いている場所に、その場でサッと停める。予約不要・設備不要の駐輪場。",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0d1425",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="font-sans antialiased">
        {/* §36 スマホファースト。広い画面でも横に広げず、中央の1カラムに収める。 */}
        <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col bg-white shadow-sm">
          {children}
        </div>
      </body>
    </html>
  );
}
