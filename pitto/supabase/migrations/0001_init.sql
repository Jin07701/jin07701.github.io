-- PITTO 初期スキーマ
-- 仕様 §31〜§34 に対応する。素の PostgreSQL SQL なので Supabase でもそのまま流せる。

create extension if not exists pgcrypto;

-- 列挙型 -------------------------------------------------------------------

-- §27 区画の状態
create type space_status as enum ('FREE', 'ACTIVE', 'FLAGGED');

-- §33 セッションの状態。異常終了や決済失敗から復旧できるよう PAYMENT_PENDING を持つ。
create type session_status as enum (
  'PENDING',
  'ACTIVE',
  'PAYMENT_PENDING',
  'COMPLETED',
  'FLAGGED'
);

-- §20 駐輪場は完全自動公開しない。必ず運営審査を挟む。
create type location_status as enum (
  'DRAFT',
  'PENDING_REVIEW',
  'PUBLISHED',
  'SUSPENDED'
);

create type owner_status as enum ('PENDING_REVIEW', 'APPROVED', 'SUSPENDED');

-- §19 MVP は自転車のみ。将来 原付/バイク/自動車 を足せるよう型で持つ。
create type vehicle_type as enum ('BICYCLE', 'MOPED', 'MOTORCYCLE', 'CAR');

create type payment_status as enum ('REQUIRES_PAYMENT', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'REFUNDED');

create type payout_status as enum ('PENDING', 'PAID', 'FAILED');

-- §15/§16 トラブル報告の種類
create type incident_type as enum (
  'UNAUTHORIZED_PARKING',
  'SPACE_ACTUALLY_FREE',
  'FORGOT_TO_END',
  'OTHER'
);

create type incident_status as enum ('OPEN', 'IN_REVIEW', 'RESOLVED', 'REJECTED');

-- 利用者 -------------------------------------------------------------------

-- §9 初回は最低限の本人識別のみ。名前・住所・生年月日は持たない。
create table users (
  id uuid primary key default gen_random_uuid(),
  phone text unique,
  email text unique,
  phone_verified_at timestamptz,
  email_verified_at timestamptz,
  stripe_customer_id text unique,
  default_payment_method_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- オーナー -----------------------------------------------------------------

create table owners (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete restrict,
  display_name text not null,
  contact_email text,
  contact_phone text,
  status owner_status not null default 'PENDING_REVIEW',
  -- §20 提供権限の同意。同意なしに駐輪場は公開できない。
  rights_agreement_accepted_at timestamptz,
  stripe_account_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index owners_user_id_idx on owners (user_id);

-- 駐輪場 -------------------------------------------------------------------

create table parking_locations (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references owners (id) on delete restrict,
  name text not null,
  address text not null,
  latitude double precision,
  longitude double precision,
  vehicle_type vehicle_type not null default 'BICYCLE',
  status location_status not null default 'DRAFT',
  -- §21 一時停止は受付中/停止のスイッチだけ。曜日カレンダーは作らない。
  accepting boolean not null default true,
  -- §21 初期値は24時間利用可能。必要なオーナーだけ固定営業時間を入れる。
  opens_at time,
  closes_at time,
  notes text,
  reviewed_at timestamptz,
  reviewed_by uuid references users (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- 営業時間は「両方 null(24時間)」か「両方指定」のどちらかのみ許す。
  constraint parking_locations_hours_pairing check (
    (opens_at is null and closes_at is null)
    or (opens_at is not null and closes_at is not null)
  )
);

create index parking_locations_owner_id_idx on parking_locations (owner_id);
create index parking_locations_status_idx on parking_locations (status);

-- 料金 ---------------------------------------------------------------------

-- §22 MVP は複雑な料金テーブルを作らない。「N分ごとM円 + 24時間上限」だけ。
create table pricing_rules (
  id uuid primary key default gen_random_uuid(),
  parking_location_id uuid not null references parking_locations (id) on delete cascade,
  base_minutes integer not null,
  base_price_jpy integer not null,
  daily_cap_jpy integer not null,
  -- 誤スキャン救済のための無料時間。仕様外の追加項目で、既定は5分。
  grace_minutes integer not null default 5,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  constraint pricing_rules_base_minutes_positive check (base_minutes > 0),
  constraint pricing_rules_base_price_nonnegative check (base_price_jpy >= 0),
  constraint pricing_rules_daily_cap_nonnegative check (daily_cap_jpy >= 0),
  constraint pricing_rules_grace_nonnegative check (grace_minutes >= 0)
);

-- 1駐輪場につき有効な料金ルールは1件だけ。
create unique index pricing_rules_one_active_per_location
  on pricing_rules (parking_location_id)
  where active;

-- 区画 ---------------------------------------------------------------------

-- §32 区画単位で持つ。§34 に従い qr_token は連番ではなく推測困難な値。
create table parking_spaces (
  id uuid primary key default gen_random_uuid(),
  parking_location_id uuid not null references parking_locations (id) on delete cascade,
  space_number text not null,
  status space_status not null default 'FREE',
  qr_token text not null unique,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (parking_location_id, space_number),
  -- 連番IDがそのまま入るのを防ぐ最低限のガード。
  constraint parking_spaces_qr_token_length check (char_length(qr_token) >= 16)
);

create index parking_spaces_location_idx on parking_spaces (parking_location_id);

-- QRトークン履歴。再発行しても過去のトークンを追跡できるようにする。
create table qr_tokens (
  id uuid primary key default gen_random_uuid(),
  parking_space_id uuid not null references parking_spaces (id) on delete cascade,
  token text not null unique,
  active boolean not null default true,
  issued_at timestamptz not null default now(),
  revoked_at timestamptz,
  constraint qr_tokens_token_length check (char_length(token) >= 16)
);

create unique index qr_tokens_one_active_per_space
  on qr_tokens (parking_space_id)
  where active;

-- 利用セッション -----------------------------------------------------------

create table parking_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete restrict,
  parking_location_id uuid not null references parking_locations (id) on delete restrict,
  parking_space_id uuid not null references parking_spaces (id) on delete restrict,
  pricing_rule_id uuid not null references pricing_rules (id) on delete restrict,
  status session_status not null default 'ACTIVE',
  -- §13 開始・終了時刻はサーバー時刻。クライアントの申告を信用しない。
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  -- 料金もサーバー側で確定させ、確定額をここに固定する。
  amount_jpy integer,
  payment_method text,
  -- §14 出庫忘れ通知をどこまで送ったか。
  last_reminder_at timestamptz,
  reminder_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint parking_sessions_ended_after_started check (
    ended_at is null or ended_at >= started_at
  ),
  constraint parking_sessions_amount_nonnegative check (
    amount_jpy is null or amount_jpy >= 0
  ),
  -- 終了済みのセッションは終了時刻と金額を必ず持つ。
  constraint parking_sessions_completed_has_totals check (
    status <> 'COMPLETED' or (ended_at is not null and amount_jpy is not null)
  )
);

-- §34 同一区画で ACTIVE なセッションを複数作れないようにする。
-- 決済待ちも区画を占有し続けるため対象に含める。
create unique index parking_sessions_one_open_per_space
  on parking_sessions (parking_space_id)
  where status in ('PENDING', 'ACTIVE', 'PAYMENT_PENDING');

create index parking_sessions_user_idx on parking_sessions (user_id, started_at desc);
create index parking_sessions_location_idx on parking_sessions (parking_location_id, started_at desc);
-- §14 長時間利用の洗い出し用。
create index parking_sessions_open_started_idx
  on parking_sessions (started_at)
  where status in ('PENDING', 'ACTIVE', 'PAYMENT_PENDING');

-- 決済 ---------------------------------------------------------------------

create table payments (
  id uuid primary key default gen_random_uuid(),
  parking_session_id uuid not null references parking_sessions (id) on delete restrict,
  amount_jpy integer not null,
  status payment_status not null default 'REQUIRES_PAYMENT',
  stripe_payment_intent_id text unique,
  -- §34 二重課金を防ぐための冪等キー。
  idempotency_key text not null unique,
  failure_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payments_amount_nonnegative check (amount_jpy >= 0)
);

create index payments_session_idx on payments (parking_session_id);

-- §26 手数料率はコードに固定せず、明細としてこちらに残す。
create table payouts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references owners (id) on delete restrict,
  payment_id uuid not null references payments (id) on delete restrict,
  gross_amount_jpy integer not null,
  fee_amount_jpy integer not null,
  net_amount_jpy integer not null,
  fee_rate_bps integer not null,
  status payout_status not null default 'PENDING',
  stripe_transfer_id text unique,
  created_at timestamptz not null default now(),
  constraint payouts_amounts_consistent check (
    gross_amount_jpy = fee_amount_jpy + net_amount_jpy
  )
);

create index payouts_owner_idx on payouts (owner_id, created_at desc);

-- トラブル報告 -------------------------------------------------------------

-- §15/§16 自動解除はしない。証拠を残して運営が判断する。
create table incident_reports (
  id uuid primary key default gen_random_uuid(),
  type incident_type not null,
  status incident_status not null default 'OPEN',
  parking_space_id uuid references parking_spaces (id) on delete set null,
  parking_session_id uuid references parking_sessions (id) on delete set null,
  reported_by_user_id uuid references users (id) on delete set null,
  reported_by_owner_id uuid references owners (id) on delete set null,
  note text,
  reported_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references users (id)
);

create index incident_reports_space_idx on incident_reports (parking_space_id, reported_at desc);
create index incident_reports_status_idx on incident_reports (status, reported_at desc);

-- 画像 ---------------------------------------------------------------------

create table parking_images (
  id uuid primary key default gen_random_uuid(),
  parking_location_id uuid references parking_locations (id) on delete cascade,
  incident_report_id uuid references incident_reports (id) on delete cascade,
  storage_path text not null,
  uploaded_by uuid references users (id) on delete set null,
  created_at timestamptz not null default now(),
  -- 駐輪場の写真か、報告の写真か、どちらかに必ず紐づく。
  constraint parking_images_belongs_to_something check (
    parking_location_id is not null or incident_report_id is not null
  )
);

create index parking_images_location_idx on parking_images (parking_location_id);
create index parking_images_incident_idx on parking_images (incident_report_id);

-- 監査ログ -----------------------------------------------------------------

-- §34 操作履歴を残す。
create table audit_logs (
  id bigserial primary key,
  actor_user_id uuid references users (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_entity_idx on audit_logs (entity_type, entity_id, created_at desc);
create index audit_logs_created_idx on audit_logs (created_at desc);
