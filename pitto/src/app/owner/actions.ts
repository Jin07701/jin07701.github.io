"use server";

import { revalidatePath } from "next/cache";

import { requireOwner } from "@/server/auth";
import { setLocationAccepting } from "@/server/owner";

/** §21 受付中/停止のスイッチ。オーナーが触れるのは自分の駐輪場だけ。 */
export async function toggleAcceptingAction(formData: FormData): Promise<void> {
  const { ownerId } = await requireOwner();
  const locationId = String(formData.get("locationId") ?? "");
  const accepting = String(formData.get("accepting") ?? "") === "true";

  await setLocationAccepting(ownerId, locationId, accepting);

  revalidatePath("/owner");
  revalidatePath(`/owner/${locationId}`);
}
