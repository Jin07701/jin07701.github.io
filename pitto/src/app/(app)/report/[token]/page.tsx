import { notFound } from "next/navigation";

import { findSpaceByToken } from "@/server/parking";

import { ReportForm } from "./report-form";

export const dynamic = "force-dynamic";

/** §15/§16 現地の状況がシステムと違うときの報告画面。 */
export default async function ReportPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const space = await findSpaceByToken(token);
  if (!space) notFound();

  return (
    <main className="flex flex-1 flex-col px-5 pb-8 pt-6">
      <h1 className="text-2xl font-bold">状況を報告する</h1>
      <p className="mt-2 text-sm text-ink-soft">
        {space.locationName} 区画{space.spaceNumber}
      </p>

      <ReportForm token={token} />
    </main>
  );
}
