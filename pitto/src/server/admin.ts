import "server-only";

import { calculateSessionFeeJpy } from "@/lib/pricing";

import { sql } from "./db";

/** §27 運営者の管理画面。オーナー・駐輪場・区画・利用・トラブル・決済を横断して見る。 */

const TZ = "Asia/Tokyo";

/** §14 これを超えて開いたままの利用は「長時間利用」として拾う。 */
export const LONG_SESSION_HOURS = 12;

export type AdminOverview = {
  ownersPendingReview: number;
  locationsPendingReview: number;
  openIncidents: number;
  activeSessions: number;
  longRunningSessions: number;
  flaggedSpaces: number;
  todayRevenueJpy: number;
  monthRevenueJpy: number;
};

export async function getAdminOverview(): Promise<AdminOverview> {
  const [row] = await sql<
    {
      owners_pending: string;
      locations_pending: string;
      open_incidents: string;
      active_sessions: string;
      long_sessions: string;
      flagged_spaces: string;
      today_revenue: string;
      month_revenue: string;
    }[]
  >`
    select
      (select count(*) from owners where status = 'PENDING_REVIEW') as owners_pending,
      (select count(*) from parking_locations where status = 'PENDING_REVIEW') as locations_pending,
      (select count(*) from incident_reports where status in ('OPEN', 'IN_REVIEW')) as open_incidents,
      (select count(*) from parking_sessions
        where status in ('PENDING', 'ACTIVE', 'PAYMENT_PENDING')) as active_sessions,
      (select count(*) from parking_sessions
        where status in ('PENDING', 'ACTIVE', 'PAYMENT_PENDING')
          and started_at < now() - ${`${LONG_SESSION_HOURS} hours`}::interval) as long_sessions,
      (select count(*) from parking_spaces where status = 'FLAGGED') as flagged_spaces,
      (select coalesce(sum(amount_jpy), 0) from parking_sessions
        where status = 'COMPLETED'
          and (ended_at at time zone ${TZ})::date = (now() at time zone ${TZ})::date) as today_revenue,
      (select coalesce(sum(amount_jpy), 0) from parking_sessions
        where status = 'COMPLETED'
          and date_trunc('month', ended_at at time zone ${TZ})
            = date_trunc('month', now() at time zone ${TZ})) as month_revenue
  `;

  return {
    ownersPendingReview: Number(row.owners_pending),
    locationsPendingReview: Number(row.locations_pending),
    openIncidents: Number(row.open_incidents),
    activeSessions: Number(row.active_sessions),
    longRunningSessions: Number(row.long_sessions),
    flaggedSpaces: Number(row.flagged_spaces),
    todayRevenueJpy: Number(row.today_revenue),
    monthRevenueJpy: Number(row.month_revenue),
  };
}

// オーナー ------------------------------------------------------------------

export type AdminOwnerRow = {
  id: string;
  displayName: string;
  contactEmail: string | null;
  status: "PENDING_REVIEW" | "APPROVED" | "SUSPENDED";
  rightsAcceptedAt: Date | null;
  locationCount: number;
  createdAt: Date;
};

export async function listOwners(): Promise<AdminOwnerRow[]> {
  const rows = await sql<
    {
      id: string;
      display_name: string;
      contact_email: string | null;
      status: AdminOwnerRow["status"];
      rights_agreement_accepted_at: Date | null;
      location_count: string;
      created_at: Date;
    }[]
  >`
    select o.id, o.display_name, o.contact_email, o.status,
           o.rights_agreement_accepted_at, o.created_at,
           count(l.id) as location_count
    from owners o
    left join parking_locations l on l.owner_id = o.id
    group by o.id
    order by
      case o.status when 'PENDING_REVIEW' then 0 when 'APPROVED' then 1 else 2 end,
      o.created_at desc
  `;

  return rows.map((row) => ({
    id: row.id,
    displayName: row.display_name,
    contactEmail: row.contact_email,
    status: row.status,
    rightsAcceptedAt: row.rights_agreement_accepted_at,
    locationCount: Number(row.location_count),
    createdAt: row.created_at,
  }));
}

export async function setOwnerStatus(
  actorUserId: string,
  ownerId: string,
  status: AdminOwnerRow["status"],
): Promise<void> {
  await sql.begin(async (tx) => {
    await tx`
      update owners set status = ${status}, updated_at = now() where id = ${ownerId}::uuid
    `;

    // オーナーを止めたら、その駐輪場も新規受付を止める。既存の利用は終了できる。
    if (status === "SUSPENDED") {
      await tx`
        update parking_locations
        set accepting = false, updated_at = now()
        where owner_id = ${ownerId}::uuid
      `;
    }

    await tx`
      insert into audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
      values (${actorUserId}::uuid, 'owner.status', 'owner', ${ownerId}, ${sql.json({ status })})
    `;
  });
}

// 駐輪場 --------------------------------------------------------------------

export type AdminLocationRow = {
  id: string;
  name: string;
  address: string;
  ownerName: string;
  status: "DRAFT" | "PENDING_REVIEW" | "PUBLISHED" | "SUSPENDED";
  accepting: boolean;
  totalSpaces: number;
  activeSpaces: number;
  flaggedSpaces: number;
  reviewedAt: Date | null;
};

export async function listLocations(): Promise<AdminLocationRow[]> {
  const rows = await sql<
    {
      id: string;
      name: string;
      address: string;
      owner_name: string;
      status: AdminLocationRow["status"];
      accepting: boolean;
      total_spaces: string;
      active_spaces: string;
      flagged_spaces: string;
      reviewed_at: Date | null;
    }[]
  >`
    select l.id, l.name, l.address, o.display_name as owner_name,
           l.status, l.accepting, l.reviewed_at,
           count(s.id) filter (where s.enabled) as total_spaces,
           count(s.id) filter (where s.status = 'ACTIVE') as active_spaces,
           count(s.id) filter (where s.status = 'FLAGGED') as flagged_spaces
    from parking_locations l
    join owners o on o.id = l.owner_id
    left join parking_spaces s on s.parking_location_id = l.id
    group by l.id, o.display_name
    order by
      case l.status when 'PENDING_REVIEW' then 0 when 'PUBLISHED' then 1 else 2 end,
      l.name
  `;

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    address: row.address,
    ownerName: row.owner_name,
    status: row.status,
    accepting: row.accepting,
    totalSpaces: Number(row.total_spaces),
    activeSpaces: Number(row.active_spaces),
    flaggedSpaces: Number(row.flagged_spaces),
    reviewedAt: row.reviewed_at,
  }));
}

export async function setLocationStatus(
  actorUserId: string,
  locationId: string,
  status: AdminLocationRow["status"],
): Promise<void> {
  await sql.begin(async (tx) => {
    await tx`
      update parking_locations
      set status = ${status},
          -- §20 公開の判断をした時点を審査記録として残す。
          reviewed_at = case when ${status} = 'PUBLISHED' then now() else reviewed_at end,
          reviewed_by = case when ${status} = 'PUBLISHED' then ${actorUserId}::uuid else reviewed_by end,
          accepting = case when ${status} = 'SUSPENDED' then false else accepting end,
          updated_at = now()
      where id = ${locationId}::uuid
    `;

    await tx`
      insert into audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
      values (
        ${actorUserId}::uuid, 'location.status', 'parking_location',
        ${locationId}, ${sql.json({ status })}
      )
    `;
  });
}

// 利用 ----------------------------------------------------------------------

export type AdminSessionRow = {
  id: string;
  locationName: string;
  spaceNumber: string;
  status: string;
  startedAt: Date;
  endedAt: Date | null;
  amountJpy: number | null;
  isLongRunning: boolean;
};

export async function listSessions(filter: "open" | "long" | "all"): Promise<AdminSessionRow[]> {
  const openStatuses = ["PENDING", "ACTIVE", "PAYMENT_PENDING"];

  const rows = await sql<
    {
      id: string;
      location_name: string;
      space_number: string;
      status: string;
      started_at: Date;
      ended_at: Date | null;
      amount_jpy: number | null;
      is_long: boolean;
    }[]
  >`
    select ps.id, l.name as location_name, s.space_number, ps.status,
           ps.started_at, ps.ended_at, ps.amount_jpy,
           (ps.status::text = any(${openStatuses})
             and ps.started_at < now() - ${`${LONG_SESSION_HOURS} hours`}::interval) as is_long
    from parking_sessions ps
    join parking_locations l on l.id = ps.parking_location_id
    join parking_spaces s on s.id = ps.parking_space_id
    where case
      when ${filter} = 'open' then ps.status::text = any(${openStatuses})
      when ${filter} = 'long' then ps.status::text = any(${openStatuses})
        and ps.started_at < now() - ${`${LONG_SESSION_HOURS} hours`}::interval
      else true
    end
    order by ps.started_at desc
    limit 100
  `;

  return rows.map((row) => ({
    id: row.id,
    locationName: row.location_name,
    spaceNumber: row.space_number,
    status: row.status,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    amountJpy: row.amount_jpy,
    isLongRunning: row.is_long,
  }));
}

/**
 * §14/§15 出庫忘れなどで開いたままの利用を運営が閉じる。
 *
 * 利用者が押した場合と同じくサーバー時刻で料金を確定させる。
 * 誰がいつ閉じたかは audit_logs に残す。
 */
export async function forceEndSession(actorUserId: string, sessionId: string): Promise<void> {
  await sql.begin(async (tx) => {
    const [session] = await tx<
      {
        id: string;
        status: string;
        started_at: Date;
        parking_space_id: string;
        base_minutes: number;
        base_price_jpy: number;
        daily_cap_jpy: number;
        grace_minutes: number;
      }[]
    >`
      select ps.id, ps.status, ps.started_at, ps.parking_space_id,
             p.base_minutes, p.base_price_jpy, p.daily_cap_jpy, p.grace_minutes
      from parking_sessions ps
      join pricing_rules p on p.id = ps.pricing_rule_id
      where ps.id = ${sessionId}::uuid
      for update of ps
    `;

    if (!session || !["PENDING", "ACTIVE", "PAYMENT_PENDING"].includes(session.status)) {
      return;
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

    await tx`
      update parking_spaces
      set status = 'FREE', updated_at = now()
      where id = ${session.parking_space_id}::uuid and status = 'ACTIVE'
    `;

    await tx`
      insert into audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
      values (
        ${actorUserId}::uuid, 'session.force_end', 'parking_session',
        ${sessionId}, ${sql.json({ amountJpy })}
      )
    `;
  });
}

// トラブル ------------------------------------------------------------------

export type AdminIncidentRow = {
  id: string;
  type: string;
  status: string;
  locationName: string | null;
  spaceNumber: string | null;
  spaceStatus: string | null;
  note: string | null;
  reportedAt: Date;
  sessionId: string | null;
};

export async function listIncidents(onlyOpen: boolean): Promise<AdminIncidentRow[]> {
  const rows = await sql<
    {
      id: string;
      type: string;
      status: string;
      location_name: string | null;
      space_number: string | null;
      space_status: string | null;
      note: string | null;
      reported_at: Date;
      parking_session_id: string | null;
    }[]
  >`
    select r.id, r.type, r.status, r.note, r.reported_at, r.parking_session_id,
           l.name as location_name, s.space_number, s.status as space_status
    from incident_reports r
    left join parking_spaces s on s.id = r.parking_space_id
    left join parking_locations l on l.id = s.parking_location_id
    where case when ${onlyOpen} then r.status in ('OPEN', 'IN_REVIEW') else true end
    order by r.reported_at desc
    limit 100
  `;

  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    status: row.status,
    locationName: row.location_name,
    spaceNumber: row.space_number,
    spaceStatus: row.space_status,
    note: row.note,
    reportedAt: row.reported_at,
    sessionId: row.parking_session_id,
  }));
}

export async function setIncidentStatus(
  actorUserId: string,
  incidentId: string,
  status: "IN_REVIEW" | "RESOLVED" | "REJECTED",
): Promise<void> {
  await sql.begin(async (tx) => {
    await tx`
      update incident_reports
      set status = ${status},
          resolved_at = case when ${status} in ('RESOLVED', 'REJECTED') then now() else null end,
          resolved_by = case when ${status} in ('RESOLVED', 'REJECTED') then ${actorUserId}::uuid else null end
      where id = ${incidentId}::uuid
    `;

    await tx`
      insert into audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
      values (
        ${actorUserId}::uuid, 'incident.status', 'incident_report',
        ${incidentId}, ${sql.json({ status })}
      )
    `;
  });
}
