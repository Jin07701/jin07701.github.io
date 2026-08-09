import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import postgres from "postgres";

import { requireDatabaseUrl } from "./env";

const MIGRATIONS_DIR = resolve(process.cwd(), "supabase/migrations");

async function main(): Promise<void> {
  const reset = process.argv.includes("--reset");
  const sql = postgres(requireDatabaseUrl(), { max: 1 });

  try {
    if (reset) {
      console.log("スキーマを作り直します (--reset)");
      await sql.unsafe("drop schema public cascade; create schema public;");
    }

    await sql.unsafe(`
      create table if not exists schema_migrations (
        version text primary key,
        applied_at timestamptz not null default now()
      );
    `);

    const applied = new Set(
      (await sql<{ version: string }[]>`select version from schema_migrations`).map(
        (row) => row.version,
      ),
    );

    const files = readdirSync(MIGRATIONS_DIR)
      .filter((file) => file.endsWith(".sql"))
      .sort();

    let count = 0;
    for (const file of files) {
      if (applied.has(file)) continue;

      const contents = readFileSync(resolve(MIGRATIONS_DIR, file), "utf8");
      // マイグレーション本体と記録を同一トランザクションに入れ、途中で落ちても中途半端に残さない。
      await sql.begin(async (tx) => {
        await tx.unsafe(contents);
        await tx`insert into schema_migrations (version) values (${file})`;
      });

      console.log(`適用: ${file}`);
      count += 1;
    }

    console.log(count === 0 ? "適用すべきマイグレーションはありません" : `${count}件適用しました`);
  } finally {
    await sql.end();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
