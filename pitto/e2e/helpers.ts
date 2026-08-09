import postgres from "postgres";

import { requireDatabaseUrl } from "../scripts/env";

export const sql = postgres(requireDatabaseUrl(), { max: 3 });

export type SeededSpace = {
  token: string;
  spaceNumber: string;
  locationId: string;
  locationName: string;
};

/** 指定した駐輪場の、まだ誰も使っていない区画を1つ借りる。テスト同士がぶつからないようにする。 */
export async function takeFreeSpace(locationName: string): Promise<SeededSpace> {
  const rows = await sql<
    { qr_token: string; space_number: string; location_id: string; location_name: string }[]
  >`
    select s.qr_token, s.space_number, l.id as location_id, l.name as location_name
    from parking_spaces s
    join parking_locations l on l.id = s.parking_location_id
    where l.name = ${locationName}
      and s.status = 'FREE'
      and not exists (
        select 1 from parking_sessions ps
        where ps.parking_space_id = s.id
          and ps.status in ('PENDING', 'ACTIVE', 'PAYMENT_PENDING')
      )
    order by s.space_number
    limit 1
  `;

  if (rows.length === 0) {
    throw new Error(`${locationName} に空き区画がありません。npm run db:reset を実行してください。`);
  }

  return {
    token: rows[0].qr_token,
    spaceNumber: rows[0].space_number,
    locationId: rows[0].location_id,
    locationName: rows[0].location_name,
  };
}

export async function setAccepting(locationId: string, accepting: boolean): Promise<void> {
  await sql`update parking_locations set accepting = ${accepting} where id = ${locationId}::uuid`;
}

export async function countIncidents(token: string): Promise<number> {
  const rows = await sql<{ count: string }[]>`
    select count(*) from incident_reports r
    join parking_spaces s on s.id = r.parking_space_id
    where s.qr_token = ${token}
  `;
  return Number(rows[0].count);
}

export async function countOpenSessions(token: string): Promise<number> {
  const rows = await sql<{ count: string }[]>`
    select count(*) from parking_sessions ps
    join parking_spaces s on s.id = ps.parking_space_id
    where s.qr_token = ${token}
      and ps.status in ('PENDING', 'ACTIVE', 'PAYMENT_PENDING')
  `;
  return Number(rows[0].count);
}

export async function spaceStatus(token: string): Promise<string> {
  const rows = await sql<{ status: string }[]>`
    select status from parking_spaces where qr_token = ${token}
  `;
  return rows[0].status;
}
