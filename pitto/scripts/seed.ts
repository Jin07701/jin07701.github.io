import postgres from "postgres";

import { hashPassword } from "../src/lib/password";
import { generateQrToken } from "../src/lib/tokens";
import { requireDatabaseUrl } from "./env";

/** 開発用のログイン。オーナー画面(§25)と管理画面(§27)を触るために作る。 */
const DEMO_OWNER = { email: "owner@pitto.example", password: "pitto-owner" };
const DEMO_STAFF = { email: "staff@pitto.example", password: "pitto-staff" };

/**
 * §37 のデモデータ。福岡・天神周辺を想定した3拠点。
 * 実在の住所は使わず、存在しない丁目番地を割り当てている。
 */
const LOCATIONS = [
  {
    name: "PITTO 天神ビル横",
    address: "福岡県福岡市中央区天神九丁目99-1 (架空)",
    latitude: 33.5902,
    longitude: 130.3985,
    spaces: 6,
    baseMinutes: 60,
    basePriceJpy: 100,
    dailyCapJpy: 500,
  },
  {
    name: "PITTO 大名店舗横",
    address: "福岡県福岡市中央区大名九丁目99-2 (架空)",
    latitude: 33.5885,
    longitude: 130.3931,
    spaces: 3,
    baseMinutes: 60,
    basePriceJpy: 100,
    dailyCapJpy: 400,
  },
  {
    name: "PITTO 今泉マンション前",
    address: "福岡県福岡市中央区今泉九丁目99-3 (架空)",
    latitude: 33.5861,
    longitude: 130.3968,
    spaces: 8,
    baseMinutes: 120,
    basePriceJpy: 100,
    dailyCapJpy: 400,
  },
] as const;

async function main(): Promise<void> {
  const sql = postgres(requireDatabaseUrl(), { max: 1 });

  try {
    await sql.begin(async (tx) => {
      const existing = await tx<{ count: string }[]>`select count(*) from parking_locations`;
      if (Number(existing[0].count) > 0) {
        console.log("すでにデータがあるためシードを中止しました。作り直す場合は npm run db:reset");
        return;
      }

      const [ownerUser] = await tx<{ id: string }[]>`
        insert into users (email, email_verified_at, password_hash)
        values (${DEMO_OWNER.email}, now(), ${hashPassword(DEMO_OWNER.password)})
        returning id
      `;

      const [owner] = await tx<{ id: string }[]>`
        insert into owners (user_id, display_name, contact_email, status, rights_agreement_accepted_at)
        values (
          ${ownerUser.id}::uuid,
          'デモオーナー',
          ${DEMO_OWNER.email},
          'APPROVED',
          now()
        )
        returning id
      `;

      // §27 の管理画面に入るPITTO運営者。
      await tx`
        insert into users (email, email_verified_at, password_hash, is_staff)
        values (${DEMO_STAFF.email}, now(), ${hashPassword(DEMO_STAFF.password)}, true)
      `;

      for (const location of LOCATIONS) {
        const [row] = await tx<{ id: string }[]>`
          insert into parking_locations (
            owner_id, name, address, latitude, longitude, status, accepting, reviewed_at
          ) values (
            ${owner.id}::uuid,
            ${location.name},
            ${location.address},
            ${location.latitude},
            ${location.longitude},
            'PUBLISHED',
            true,
            now()
          )
          returning id
        `;

        await tx`
          insert into pricing_rules (
            parking_location_id, base_minutes, base_price_jpy, daily_cap_jpy
          ) values (
            ${row.id}::uuid,
            ${location.baseMinutes},
            ${location.basePriceJpy},
            ${location.dailyCapJpy}
          )
        `;

        for (let index = 1; index <= location.spaces; index += 1) {
          const spaceNumber = String(index).padStart(2, "0");
          const token = generateQrToken();

          const [space] = await tx<{ id: string }[]>`
            insert into parking_spaces (parking_location_id, space_number, qr_token)
            values (${row.id}::uuid, ${spaceNumber}, ${token})
            returning id
          `;

          await tx`
            insert into qr_tokens (parking_space_id, token)
            values (${space.id}::uuid, ${token})
          `;
        }

        console.log(`作成: ${location.name} (${location.spaces}区画)`);
      }
    });

    const spaces = await sql<{ name: string; space_number: string; qr_token: string }[]>`
      select l.name, s.space_number, s.qr_token
      from parking_spaces s
      join parking_locations l on l.id = s.parking_location_id
      order by l.name, s.space_number
    `;

    console.log("\n開発用ログイン:");
    console.log(`  オーナー画面 /owner  ${DEMO_OWNER.email} / ${DEMO_OWNER.password}`);
    console.log(`  管理画面     /admin  ${DEMO_STAFF.email} / ${DEMO_STAFF.password}`);

    const base = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
    console.log("\n区画QRのURL:");
    for (const space of spaces) {
      console.log(`  ${space.name} ${space.space_number}  ${base}/s/${space.qr_token}`);
    }
  } finally {
    await sql.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
