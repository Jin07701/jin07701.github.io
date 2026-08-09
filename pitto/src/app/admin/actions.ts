"use server";

import { revalidatePath } from "next/cache";

import {
  forceEndSession,
  setIncidentStatus,
  setLocationStatus,
  setOwnerStatus,
  type AdminLocationRow,
  type AdminOwnerRow,
} from "@/server/admin";
import { requireStaff } from "@/server/auth";

const OWNER_STATUSES: AdminOwnerRow["status"][] = ["PENDING_REVIEW", "APPROVED", "SUSPENDED"];
const LOCATION_STATUSES: AdminLocationRow["status"][] = [
  "DRAFT",
  "PENDING_REVIEW",
  "PUBLISHED",
  "SUSPENDED",
];
const INCIDENT_STATUSES = ["IN_REVIEW", "RESOLVED", "REJECTED"] as const;

export async function setOwnerStatusAction(formData: FormData): Promise<void> {
  const account = await requireStaff();
  const ownerId = String(formData.get("ownerId") ?? "");
  const status = String(formData.get("status") ?? "") as AdminOwnerRow["status"];

  if (!OWNER_STATUSES.includes(status)) return;

  await setOwnerStatus(account.userId, ownerId, status);
  revalidatePath("/admin/owners");
  revalidatePath("/admin");
}

export async function setLocationStatusAction(formData: FormData): Promise<void> {
  const account = await requireStaff();
  const locationId = String(formData.get("locationId") ?? "");
  const status = String(formData.get("status") ?? "") as AdminLocationRow["status"];

  if (!LOCATION_STATUSES.includes(status)) return;

  await setLocationStatus(account.userId, locationId, status);
  revalidatePath("/admin/locations");
  revalidatePath("/admin");
}

/** §14 出庫忘れなどで開いたままの利用を運営が閉じる。 */
export async function forceEndSessionAction(formData: FormData): Promise<void> {
  const account = await requireStaff();
  const sessionId = String(formData.get("sessionId") ?? "");

  await forceEndSession(account.userId, sessionId);
  revalidatePath("/admin/sessions");
  revalidatePath("/admin");
}

export async function setIncidentStatusAction(formData: FormData): Promise<void> {
  const account = await requireStaff();
  const incidentId = String(formData.get("incidentId") ?? "");
  const status = String(formData.get("status") ?? "") as (typeof INCIDENT_STATUSES)[number];

  if (!INCIDENT_STATUSES.includes(status)) return;

  await setIncidentStatus(account.userId, incidentId, status);
  revalidatePath("/admin/incidents");
  revalidatePath("/admin");
}
