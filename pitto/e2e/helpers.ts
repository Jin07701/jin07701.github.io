import postgres from "postgres";

import { requireDatabaseUrl } from "../scripts/env";

/**
 * テストからDBを直接見るための接続。
 *
 * スペックごとに afterAll で閉じるため、閉じられていたら作り直せるように遅延生成にしている。
 */
let client: postgres.Sql | null = null;

function db(): postgres.Sql {
  if (!client) {
    client = postgres(requireDatabaseUrl(), { max: 3 });
  }
  return client;
}

export async function closeDb(): Promise<void> {
  if (client) {
    await client.end();
    client = null;
  }
}

export type SeededSpace = {
  token: string;
  spaceNumber: string;
  locationId: string;
  locationName: string;
};

/** 指定した駐輪場の、まだ誰も使っていない区画を1つ借りる。テスト同士がぶつからないようにする。 */
export async function takeFreeSpace(locationName: string): Promise<SeededSpace> {
  const rows = await db()<
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
  await db()`update parking_locations set accepting = ${accepting} where id = ${locationId}::uuid`;
}

export async function isAccepting(locationId: string): Promise<boolean> {
  const rows = await db()<{ accepting: boolean }[]>`
    select accepting from parking_locations where id = ${locationId}::uuid
  `;
  return rows[0].accepting;
}

export async function countIncidents(token: string): Promise<number> {
  const rows = await db()<{ count: string }[]>`
    select count(*) from incident_reports r
    join parking_spaces s on s.id = r.parking_space_id
    where s.qr_token = ${token}
  `;
  return Number(rows[0].count);
}

export async function countOpenSessions(token: string): Promise<number> {
  const rows = await db()<{ count: string }[]>`
    select count(*) from parking_sessions ps
    join parking_spaces s on s.id = ps.parking_space_id
    where s.qr_token = ${token}
      and ps.status in ('PENDING', 'ACTIVE', 'PAYMENT_PENDING')
  `;
  return Number(rows[0].count);
}

export async function spaceStatus(token: string): Promise<string> {
  const rows = await db()<{ status: string }[]>`
    select status from parking_spaces where qr_token = ${token}
  `;
  return rows[0].status;
}

export async function incidentStatus(token: string): Promise<string | null> {
  const rows = await db()<{ status: string }[]>`
    select r.status from incident_reports r
    join parking_spaces s on s.id = r.parking_space_id
    where s.qr_token = ${token}
    order by r.reported_at desc
    limit 1
  `;
  return rows[0]?.status ?? null;
}

export async function locationStatus(locationId: string): Promise<string> {
  const rows = await db()<{ status: string }[]>`
    select status from parking_locations where id = ${locationId}::uuid
  `;
  return rows[0].status;
}

/** シードが作る開発用ログイン。 */
export const DEMO_OWNER = { email: "owner@pitto.example", password: "pitto-owner" };
export const DEMO_STAFF = { email: "staff@pitto.example", password: "pitto-staff" };
