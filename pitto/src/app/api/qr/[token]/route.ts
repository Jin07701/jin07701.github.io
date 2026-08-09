import QRCode from "qrcode";

import { isValidQrTokenFormat } from "@/lib/tokens";
import { findSpaceByToken } from "@/server/parking";

/** §23 区画QRの画像。印刷用の台紙からこのURLを参照する。 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  if (!isValidQrTokenFormat(token)) {
    return new Response("Not Found", { status: 404 });
  }

  const space = await findSpaceByToken(token);
  if (!space) {
    return new Response("Not Found", { status: 404 });
  }

  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
  const png = await QRCode.toBuffer(`${base}/s/${token}`, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 512,
  });

  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      // トークンが変わらない限り内容は同じ。印刷前提なので長めにキャッシュしてよい。
      "Cache-Control": "public, max-age=86400",
    },
  });
}
