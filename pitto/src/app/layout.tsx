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

/**
 * ルートは html/body だけを持つ。
 * 画面の枠は (app) / (marketing) / owner / admin の各レイアウトが決める。
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
