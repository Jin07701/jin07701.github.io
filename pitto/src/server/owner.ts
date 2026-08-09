import "server-only";

import { sql } from "./db";

/**
 * §25 オーナーダッシュボード。
 *
 * 売上は Phase 2 で payments を入れるまで、確定済みセッションの金額
 * (parking_sessions.amount_jpy) を集計している。手数料を引く前の総額。
 * 集計の日付は日本時間で切る。
 */
const TZ = "Asia/Tokyo";

export type OwnerLocationRow = {
  id: string;
  name: string;
  address: string;
  status: "DRAFT" | "PENDING_REVIEW" | "PUBLISHED" | "SUSPENDED";
  accepting: boolean;
  totalSpaces: number;
  activeSpaces: number;
  todayRevenueJpy: number;
  monthRevenueJpy: number;
  openIncidents: number;
};

export type OwnerSummary = {
  todayRevenueJpy: number;
  monthRevenueJpy: number;
  activeSpaces: number;
  totalSpaces: number;
  locations: OwnerLocationRow[];
};

export async function getOwnerSummary(ownerId: string): Promise<OwnerSummary> {
  const rows = await sql<
    {
      id: string;
      name: string;
      address: string;
      status: OwnerLocationRow["status"];
      accepting: boolean;
      total_spaces: string;
      active_spaces: string;
      today_revenue: string;
      month_revenue: string;
      open_incidents: string;
    }[]
  >`
    select
      l.id, l.name, l.address, l.status, l.accepting,
      count(distinct s.id) filter (where s.enabled) as total_spaces,
      count(distinct s.id) filter (where s.enabled and s.status = 'ACTIVE') as active_spaces,
      coalesce(sum(done.amount_jpy) filter (
        where (done.ended_at at time zone ${TZ})::date = (now() at time zone ${TZ})::date
      ), 0) as today_revenue,
      coalesce(sum(done.amount_jpy) filter (
        where date_trunc('month', done.ended_at at time zone ${TZ})
            = date_trunc('month', now() at time zone ${TZ})
      ), 0) as month_revenue,
      count(distinct inc.id) filter (where inc.status in ('OPEN', 'IN_REVIEW')) as open_incidents
    from parking_locations l
    left join parking_spaces s on s.parking_location_id = l.id
    left join parking_sessions done
      on done.parking_location_id = l.id and done.status = 'COMPLETED'
    left join incident_reports inc on inc.parking_space_id = s.id
    where l.owner_id = ${ownerId}::uuid
    group by l.id
    order by l.name
  `;

  const locations = rows.map((row) => ({
    id: row.id,
    name: row.name,
    address: row.address,
    status: row.status,
    accepting: row.accepting,
    totalSpaces: Number(row.total_spaces),
    activeSpaces: Number(row.active_spaces),
    todayRevenueJpy: Number(row.today_revenue),
    monthRevenueJpy: Number(row.month_revenue),
    openIncidents: Number(row.open_incidents),
  }));

  return {
    todayRevenueJpy: locations.reduce((total, item) => total + item.todayRevenueJpy, 0),
    monthRevenueJpy: locations.reduce((total, item) => total + item.monthRevenueJpy, 0),
    activeSpaces: locations.reduce((total, item) => total + item.activeSpaces, 0),
    totalSpaces: locations.reduce((total, item) => total + item.totalSpaces, 0),
    locations,
  };
}

export type OwnerSpaceRow = {
  id: string;
  spaceNumber: string;
  status: "FREE" | "ACTIVE" | "FLAGGED";
  qrToken: string;
  startedAt: Date | null;
};

export type OwnerSessionRow = {
  id: string;
  spaceNumber: string;
  startedAt: Date;
  endedAt: Date | null;
  amountJpy: number | null;
  status: string;
};

export type OwnerIncidentRow = {
  id: string;
  type: string;
  status: string;
  spaceNumber: string | null;
  note: string | null;
  reportedAt: Date;
};

export type OwnerLocationDetail = {
  location: OwnerLocationRow;
  spaces: OwnerSpaceRow[];
  sessions: OwnerSessionRow[];
  incidents: OwnerIncidentRow[];
};

/** オーナー本人の駐輪場だけを返す。他人の駐輪場IDを渡されても null になる。 */
export async function getOwnerLocationDetail(
  ownerId: string,
  locationId: string,
): Promise<OwnerLocationDetail | null> {
  const summary = await getOwnerSummary(ownerId);
  const location = summary.locations.find((item) => item.id === locationId);
  if (!location) return null;

  const [spaces, sessions, incidents] = await Promise.all([
    sql<
      {
        id: string;
        space_number: string;
        status: OwnerSpaceRow["status"];
        qr_token: string;
        started_at: Date | null;
      }[]
    >`
      select s.id, s.space_number, s.status, s.qr_token, open.started_at
      from parking_spaces s
      left join lateral (
        select started_at from parking_sessions ps
        where ps.parking_space_id = s.id
          and ps.status in ('PENDING', 'ACTIVE', 'PAYMENT_PENDING')
        limit 1
      ) open on true
      where s.parking_location_id = ${locationId}::uuid
      order by s.space_number
    `,
    sql<
      {
        id: string;
        space_number: string;
        started_at: Date;
        ended_at: Date | null;
        amount_jpy: number | null;
        status: string;
      }[]
    >`
      select ps.id, s.space_number, ps.started_at, ps.ended_at, ps.amount_jpy, ps.status
      from parking_sessions ps
      join parking_spaces s on s.id = ps.parking_space_id
      where ps.parking_location_id = ${locationId}::uuid
      order by ps.started_at desc
      limit 30
    `,
    sql<
      {
        id: string;
        type: string;
        status: string;
        space_number: string | null;
        note: string | null;
        reported_at: Date;
      }[]
    >`
      select r.id, r.type, r.status, s.space_number, r.note, r.reported_at
      from incident_reports r
      join parking_spaces s on s.id = r.parking_space_id
      where s.parking_location_id = ${locationId}::uuid
      order by r.reported_at desc
      limit 30
    `,
  ]);

  return {
    location,
    spaces: spaces.map((row) => ({
      id: row.id,
      spaceNumber: row.space_number,
      status: row.status,
      qrToken: row.qr_token,
      startedAt: row.started_at,
    })),
    sessions: sessions.map((row) => ({
      id: row.id,
      spaceNumber: row.space_number,
      startedAt: row.started_at,
      endedAt: row.ended_at,
      amountJpy: row.amount_jpy,
      status: row.status,
    })),
    incidents: incidents.map((row) => ({
      id: row.id,
      type: row.type,
      status: row.status,
      spaceNumber: row.space_number,
      note: row.note,
      reportedAt: row.reported_at,
    })),
  };
}

/**
 * §21 受付中/停止のスイッチ。
 * 停止しても進行中の利用は終了できる(§38 ケース6)。
 */
export async function setLocationAccepting(
  ownerId: string,
  locationId: string,
  accepting: boolean,
): Promise<boolean> {
  const rows = await sql<{ id: string }[]>`
    update parking_locations
    set accepting = ${accepting}, updated_at = now()
    where id = ${locationId}::uuid and owner_id = ${ownerId}::uuid
    returning id
  `;
  return rows.length > 0;
}
