"use server";

import { redirect } from "next/navigation";

import type { ActionState } from "@/lib/action-state";
import { getCurrentUserId, getOrCreateUserId } from "@/server/identity";
import {
  endSession,
  ParkingError,
  reportIncident,
  startSession,
  type ReportableIncidentType,
} from "@/server/parking";

/**
 * 利用開始。§8〜§11 の導線。
 * 利用者に入力させるのは「この区画を利用する」を押す操作だけ。
 */
export async function startParkingAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const token = String(formData.get("token") ?? "");

  let sessionId: string;
  try {
    const userId = await getOrCreateUserId();
    sessionId = await startSession(token, userId);
  } catch (error) {
    if (error instanceof ParkingError) {
      return { error: error.message };
    }
    throw error;
  }

  // redirect は例外で制御が飛ぶため try の外に置く。
  redirect(`/session/${sessionId}`);
}

/** 利用終了。§13 の導線。料金は endSession がサーバー側で確定させる。 */
export async function endParkingAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const sessionId = String(formData.get("sessionId") ?? "");

  try {
    const userId = await getCurrentUserId();
    if (!userId) {
      return { error: "利用者情報が確認できませんでした。QRを読み直してください。" };
    }
    await endSession(sessionId, userId);
  } catch (error) {
    if (error instanceof ParkingError) {
      return { error: error.message };
    }
    throw error;
  }

  redirect(`/session/${sessionId}/done`);
}

const REPORTABLE_TYPES: ReportableIncidentType[] = [
  "SPACE_ACTUALLY_FREE",
  "UNAUTHORIZED_PARKING",
];

/**
 * §15/§16 のトラブル報告。
 * 受け付けるのは記録までで、区画の状態は自動では変えない。解除の判断は運営が行う。
 */
export async function submitIncidentAction(
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const token = String(formData.get("token") ?? "");
  const type = String(formData.get("type") ?? "");
  const note = String(formData.get("note") ?? "").trim();

  if (!REPORTABLE_TYPES.includes(type as ReportableIncidentType)) {
    return { error: "報告の種類を選んでください。" };
  }

  try {
    const userId = await getOrCreateUserId();
    await reportIncident({
      token,
      type: type as ReportableIncidentType,
      note: note.slice(0, 500) || null,
      userId,
    });
  } catch (error) {
    if (error instanceof ParkingError) {
      return { error: error.message };
    }
    throw error;
  }

  redirect(`/report/${token}/done`);
}
