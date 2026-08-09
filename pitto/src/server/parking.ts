import "server-only";

import postgres from "postgres";

import { calculateSessionFeeJpy, type PricingRule } from "@/lib/pricing";
import { isValidQrTokenFormat } from "@/lib/tokens";

import { sql } from "./db";

export type SpaceView = {
  spaceId: string;
  spaceNumber: string;
  spaceStatus: "FREE" | "ACTIVE" | "FLAGGED";
  spaceEnabled: boolean;
  locationId: string;
  locationName: string;
  locationAddress: string;
  locationStatus: "DRAFT" | "PENDING_REVIEW" | "PUBLISHED" | "SUSPENDED";
  accepting: boolean;
  opensAt: string | null;
  closesAt: string | null;
  pricingRuleId: string;
  rule: PricingRule;
  /** その区画で進行中のセッション。なければ null。 */
  openSessionId: string | null;
};

export type SessionView = {
  id: string;
  userId: string;
  status: "PENDING" | "ACTIVE" | "PAYMENT_PENDING" | "COMPLETED" | "FLAGGED";
  startedAt: Date;
  endedAt: Date | null;
  amountJpy: number | null;
  spaceNumber: string;
  locationName: string;
  locationAddress: string;
  rule: PricingRule;
};

/** 業務ルール違反。呼び出し側が利用者向けメッセージとしてそのまま出せる粒度にしている。 */
export class ParkingError extends Error {
  constructor(
    readonly code:
      | "NOT_FOUND"
      | "SPACE_DISABLED"
      | "LOCATION_UNAVAILABLE"
      | "OUTSIDE_HOURS"
      | "ALREADY_IN_USE"
      | "SESSION_NOT_OPEN"
      | "FORBIDDEN",
    message: string,
  ) {
    super(message);
    this.name = "ParkingError";
  }
}

const SPACE_SELECT = sql`
  select
    s.id                        as space_id,
    s.space_number              as space_number,
    s.status                    as space_status,
    s.enabled                   as space_enabled,
    l.id                        as location_id,
    l.name                      as location_name,
    l.address                   as location_address,
    l.status                    as location_status,
    l.accepting                 as accepting,
    l.opens_at                  as opens_at,
    l.closes_at                 as closes_at,
    p.id                        as pricing_rule_id,
    p.base_minutes              as base_minutes,
    p.base_price_jpy            as base_price_jpy,
    p.daily_cap_jpy             as daily_cap_jpy,
    p.grace_minutes             as grace_minutes,
    open_session.id             as open_session_id
  from parking_spaces s
  join parking_locations l on l.id = s.parking_location_id
  join pricing_rules p on p.parking_location_id = l.id and p.active
  left join lateral (
    select id
    from parking_sessions ps
    where ps.parking_space_id = s.id
      and ps.status in ('PENDING', 'ACTIVE', 'PAYMENT_PENDING')
    limit 1
  ) open_session on true
`;

type SpaceRow = {
  space_id: string;
  space_number: string;
  space_status: SpaceView["spaceStatus"];
  space_enabled: boolean;
  location_id: string;
  location_name: string;
  location_address: string;
  location_status: SpaceView["locationStatus"];
  accepting: boolean;
  opens_at: string | null;
  closes_at: string | null;
  pricing_rule_id: string;
  base_minutes: number;
  base_price_jpy: number;
  daily_cap_jpy: number;
  grace_minutes: number;
  open_session_id: string | null;
};

function toSpaceView(row: SpaceRow): SpaceView {
  return {
    spaceId: row.space_id,
    spaceNumber: row.space_number,
    spaceStatus: row.space_status,
    spaceEnabled: row.space_enabled,
    locationId: row.location_id,
    locationName: row.location_name,
    locationAddress: row.location_address,
    locationStatus: row.location_status,
    accepting: row.accepting,
    opensAt: row.opens_at,
    closesAt: row.closes_at,
    pricingRuleId: row.pricing_rule_id,
    rule: {
      baseMinutes: row.base_minutes,
      basePriceJpy: row.base_price_jpy,
      dailyCapJpy: row.daily_cap_jpy,
      graceMinutes: row.grace_minutes,
    },
    openSessionId: row.open_session_id,
  };
}

/** QRトークンから区画を引く。§34 に従い連番IDでは引けない。 */
export async function findSpaceByToken(token: string): Promise<SpaceView | null> {
  if (!isValidQrTokenFormat(token)) return null;

  const rows = await sql<SpaceRow[]>`
    ${SPACE_SELECT}
    where s.qr_token = ${token}
  `;

  return rows[0] ? toSpaceView(rows[0]) : null;
}

/**
 * 営業時間の判定。§21 のとおり曜日別カレンダーは持たず、毎日同じ固定時間だけを見る。
 * 22:00〜翌6:00 のような日をまたぐ設定にも対応する。
 */
export function isWithinOpeningHours(space: SpaceView, now: Date): boolean {
  if (!space.opensAt || !space.closesAt) return true; // 24時間利用可能

  const toMinutes = (value: string): number => {
    const [hours, minutes] = value.split(":").map(Number);
    return hours * 60 + minutes;
  };

  const opens = toMinutes(space.opensAt);
  const closes = toMinutes(space.closesAt);
  const current = now.getHours() * 60 + now.getMinutes();

  return opens <= closes
    ? current >= opens && current < closes
    : current >= opens || current < closes;
}

/** 利用開始できる状態か検査する。表示用にも利用開始時にも同じ判定を通す。 */
export function assertSpaceIsUsable(space: SpaceView, now: Date): void {
  if (!space.spaceEnabled) {
    throw new ParkingError("SPACE_DISABLED", "この区画は現在ご利用いただけません。");
  }
  if (space.locationStatus !== "PUBLISHED") {
    throw new ParkingError("LOCATION_UNAVAILABLE", "この駐輪場は現在公開されていません。");
  }
  // §38 ケース6: オーナーが停止したら新規開始はできない。既存セッションの終了は妨げない。
  if (!space.accepting) {
    throw new ParkingError("LOCATION_UNAVAILABLE", "この駐輪場は現在受付を停止しています。");
  }
  if (!isWithinOpeningHours(space, now)) {
    throw new ParkingError(
      "OUTSIDE_HOURS",
      `この駐輪場の利用時間は ${space.opensAt?.slice(0, 5)}〜${space.closesAt?.slice(0, 5)} です。`,
    );
  }
  if (space.openSessionId) {
    throw new ParkingError("ALREADY_IN_USE", "この区画はすでに利用中です。");
  }
}

const UNIQUE_VIOLATION = "23505";

/**
 * 利用開始。
 *
 * §38 ケース2 のとおり、2人が同時に同じ区画を開始しようとしても片方だけが成功する。
 * 判定はアプリ側の事前チェックではなく DB の部分ユニークインデックスに委ねていて、
 * 競合したトランザクションは 23505 で落ちる。
 */
export async function startSession(token: string, userId: string): Promise<string> {
  const space = await findSpaceByToken(token);
  if (!space) {
    throw new ParkingError("NOT_FOUND", "この区画は見つかりませんでした。");
  }

  assertSpaceIsUsable(space, new Date());

  try {
    return await sql.begin(async (tx) => {
      const [session] = await tx<{ id: string }[]>`
        insert into parking_sessions (
          user_id, parking_location_id, parking_space_id, pricing_rule_id, status, started_at
        ) values (
          ${userId}::uuid,
          ${space.locationId}::uuid,
          ${space.spaceId}::uuid,
          ${space.pricingRuleId}::uuid,
          'ACTIVE',
          now()
        )
        returning id
      `;

      await tx`
        update parking_spaces
        set status = 'ACTIVE', updated_at = now()
        where id = ${space.spaceId}::uuid
      `;

      await tx`
        insert into audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
        values (
          ${userId}::uuid,
          'session.start',
          'parking_session',
          ${session.id},
          ${sql.json({ spaceId: space.spaceId, locationId: space.locationId })}
        )
      `;

      return session.id;
    });
  } catch (error) {
    if (error instanceof postgres.PostgresError && error.code === UNIQUE_VIOLATION) {
      throw new ParkingError("ALREADY_IN_USE", "この区画はすでに利用中です。");
    }
    throw error;
  }
}

type SessionRow = {
  id: string;
  user_id: string;
  status: SessionView["status"];
  started_at: Date;
  ended_at: Date | null;
  amount_jpy: number | null;
  space_number: string;
  location_name: string;
  location_address: string;
  base_minutes: number;
  base_price_jpy: number;
  daily_cap_jpy: number;
  grace_minutes: number;
};

function toSessionView(row: SessionRow): SessionView {
  return {
    id: row.id,
    userId: row.user_id,
    status: row.status,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    amountJpy: row.amount_jpy,
    spaceNumber: row.space_number,
    locationName: row.location_name,
    locationAddress: row.location_address,
    rule: {
      baseMinutes: row.base_minutes,
      basePriceJpy: row.base_price_jpy,
      dailyCapJpy: row.daily_cap_jpy,
      graceMinutes: row.grace_minutes,
    },
  };
}

export async function findSession(sessionId: string): Promise<SessionView | null> {
  const rows = await sql<SessionRow[]>`
    select
      ps.id, ps.user_id, ps.status, ps.started_at, ps.ended_at, ps.amount_jpy,
      s.space_number, l.name as location_name, l.address as location_address,
      p.base_minutes, p.base_price_jpy, p.daily_cap_jpy, p.grace_minutes
    from parking_sessions ps
    join parking_spaces s on s.id = ps.parking_space_id
    join parking_locations l on l.id = ps.parking_location_id
    join pricing_rules p on p.id = ps.pricing_rule_id
    where ps.id = ${sessionId}::uuid
  `;

  return rows[0] ? toSessionView(rows[0]) : null;
}

/**
 * 利用終了。
 *
 * 料金は §13 のとおりサーバー側で確定させる。終了時刻も DB の now() を使い、
 * クライアントから受け取った時刻や金額は一切参照しない。
 *
 * Phase 1 は決済を挟まないため直接 COMPLETED にする。
 * Phase 2 で Stripe を入れる際は PAYMENT_PENDING を経由し、Webhook を正として COMPLETED に遷移させる。
 */
export async function endSession(
  sessionId: string,
  userId: string,
): Promise<{ amountJpy: number; endedAt: Date }> {
  return sql.begin(async (tx) => {
    // 同じセッションへの二重終了を直列化する。
    const [session] = await tx<
      {
        id: string;
        user_id: string;
        status: SessionView["status"];
        started_at: Date;
        parking_space_id: string;
        base_minutes: number;
        base_price_jpy: number;
        daily_cap_jpy: number;
        grace_minutes: number;
      }[]
    >`
      select
        ps.id, ps.user_id, ps.status, ps.started_at, ps.parking_space_id,
        p.base_minutes, p.base_price_jpy, p.daily_cap_jpy, p.grace_minutes
      from parking_sessions ps
      join pricing_rules p on p.id = ps.pricing_rule_id
      where ps.id = ${sessionId}::uuid
      for update of ps
    `;

    if (!session) {
      throw new ParkingError("NOT_FOUND", "利用情報が見つかりませんでした。");
    }
    if (session.user_id !== userId) {
      throw new ParkingError("FORBIDDEN", "この利用を終了する権限がありません。");
    }
    if (session.status !== "ACTIVE" && session.status !== "PENDING") {
      throw new ParkingError("SESSION_NOT_OPEN", "この利用はすでに終了しています。");
    }

    const [{ now: endedAt }] = await tx<{ now: Date }[]>`select now() as now`;

    const amountJpy = calculateSessionFeeJpy(session.started_at, endedAt, {
      baseMinutes: session.base_minutes,
      basePriceJpy: session.base_price_jpy,
      dailyCapJpy: session.daily_cap_jpy,
      graceMinutes: session.grace_minutes,
    });

    await tx`
      update parking_sessions
      set status = 'COMPLETED', ended_at = ${endedAt}, amount_jpy = ${amountJpy}, updated_at = now()
      where id = ${sessionId}::uuid
    `;

    // 荒らし報告で FLAGGED になっている区画は、勝手に FREE へ戻さず運営の判断を待つ。
    await tx`
      update parking_spaces
      set status = 'FREE', updated_at = now()
      where id = ${session.parking_space_id}::uuid
        and status = 'ACTIVE'
    `;

    await tx`
      insert into audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
      values (
        ${userId}::uuid,
        'session.end',
        'parking_session',
        ${sessionId},
        ${sql.json({ amountJpy })}
      )
    `;

    return { amountJpy, endedAt };
  });
}

export type LocationSummary = {
  id: string;
  name: string;
  address: string;
  accepting: boolean;
  totalSpaces: number;
  /** §17 センサーがない以上これは「システム上の空き」であって現地の実態ではない。 */
  systemFreeSpaces: number;
  rule: PricingRule;
};

/** §28 の一覧表示に使う。公開済みの駐輪場だけを返す。 */
export async function listPublishedLocations(): Promise<LocationSummary[]> {
  const rows = await sql<
    {
      id: string;
      name: string;
      address: string;
      accepting: boolean;
      total_spaces: string;
      system_free_spaces: string;
      base_minutes: number;
      base_price_jpy: number;
      daily_cap_jpy: number;
      grace_minutes: number;
    }[]
  >`
    select
      l.id, l.name, l.address, l.accepting,
      count(s.id) filter (where s.enabled) as total_spaces,
      count(s.id) filter (where s.enabled and s.status = 'FREE') as system_free_spaces,
      p.base_minutes, p.base_price_jpy, p.daily_cap_jpy, p.grace_minutes
    from parking_locations l
    join pricing_rules p on p.parking_location_id = l.id and p.active
    left join parking_spaces s on s.parking_location_id = l.id
    where l.status = 'PUBLISHED'
    group by l.id, p.base_minutes, p.base_price_jpy, p.daily_cap_jpy, p.grace_minutes
    order by l.name
  `;

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    address: row.address,
    accepting: row.accepting,
    totalSpaces: Number(row.total_spaces),
    systemFreeSpaces: Number(row.system_free_spaces),
    rule: {
      baseMinutes: row.base_minutes,
      basePriceJpy: row.base_price_jpy,
      dailyCapJpy: row.daily_cap_jpy,
      graceMinutes: row.grace_minutes,
    },
  }));
}

export type LocationDetail = LocationSummary & {
  spaces: { id: string; spaceNumber: string; status: SpaceView["spaceStatus"]; qrToken: string }[];
};

/** §23 のQRセット表示に使う。区画とそのQRトークンを並べる。 */
export async function findLocationWithSpaces(id: string): Promise<LocationDetail | null> {
  const summaries = await listPublishedLocations();
  const summary = summaries.find((item) => item.id === id);
  if (!summary) return null;

  const spaces = await sql<
    { id: string; space_number: string; status: SpaceView["spaceStatus"]; qr_token: string }[]
  >`
    select id, space_number, status, qr_token
    from parking_spaces
    where parking_location_id = ${id}::uuid and enabled
    order by space_number
  `;

  return {
    ...summary,
    spaces: spaces.map((space) => ({
      id: space.id,
      spaceNumber: space.space_number,
      status: space.status,
      qrToken: space.qr_token,
    })),
  };
}

/** 利用者が報告できるトラブルの種類。運営内部でしか使わない種別はここに出さない。 */
export type ReportableIncidentType = "SPACE_ACTUALLY_FREE" | "UNAUTHORIZED_PARKING";

/**
 * §15/§16 のトラブル報告を記録する。
 *
 * §15 のとおり、報告を受けても区画の状態は自動では変えない。
 * 不正な解除を防ぐため、誰がいつ報告したかを残して運営の判断を待つ。
 */
export async function reportIncident(input: {
  token: string;
  type: ReportableIncidentType;
  note: string | null;
  userId: string;
}): Promise<string> {
  const space = await findSpaceByToken(input.token);
  if (!space) {
    throw new ParkingError("NOT_FOUND", "この区画は見つかりませんでした。");
  }

  const [report] = await sql<{ id: string }[]>`
    insert into incident_reports (
      type, parking_space_id, parking_session_id, reported_by_user_id, note
    ) values (
      ${input.type},
      ${space.spaceId}::uuid,
      ${space.openSessionId}::uuid,
      ${input.userId}::uuid,
      ${input.note}
    )
    returning id
  `;

  await sql`
    insert into audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
    values (
      ${input.userId}::uuid,
      'incident.report',
      'incident_report',
      ${report.id},
      ${sql.json({ type: input.type, spaceId: space.spaceId })}
    )
  `;

  return report.id;
}

/** 利用者が現在進行中のセッションを持っていれば返す。 */
export async function findOpenSessionForUser(userId: string): Promise<string | null> {
  const rows = await sql<{ id: string }[]>`
    select id from parking_sessions
    where user_id = ${userId}::uuid
      and status in ('PENDING', 'ACTIVE', 'PAYMENT_PENDING')
    order by started_at desc
    limit 1
  `;
  return rows[0]?.id ?? null;
}
