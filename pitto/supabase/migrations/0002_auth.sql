-- オーナー画面(§25)と運営者の管理画面(§27)にログインを入れる。
--
-- 利用者側は §9 のとおり Cookie だけで識別を続ける。ここで足すのは
-- 「スペースを提供する側」と「PITTOを運営する側」のためのログインで、
-- Phase 2 で Supabase Auth に載せ替えるまでのつなぎ。

alter table users
  add column password_hash text,
  -- PITTO運営者。§27 の管理画面に入れるのはこのフラグを持つ利用者だけ。
  add column is_staff boolean not null default false;

-- ログインに使えるのはメールアドレスを確認済みの利用者だけ。
create index users_login_idx on users (email) where password_hash is not null;

create index users_staff_idx on users (id) where is_staff;
