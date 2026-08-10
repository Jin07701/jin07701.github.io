# PITTO

> ※仮称。商標・ドメイン確認前のため名称は暫定。

「空いている場所に、その場でサッと停める」
予約不要・設備不要のマイクロ駐輪場プラットフォーム。

利用者は現地の区画QRを読むだけで停められる。アプリのインストールも予約も要らない。
オーナーは余っている数㎡を登録し、QRを貼るだけで小さなコイン駐輪場にできる。

- コンセプトの詳細: [docs/concept.md](docs/concept.md)
- データ構造とセキュリティ: [docs/data-model.md](docs/data-model.md)
- フェーズと現状: [docs/roadmap.md](docs/roadmap.md)

現在動くのは以下。

- **利用者フロー**(Phase 1) — QR生成 → QR読み込み → 利用開始 → 利用終了
- **サービス紹介ページ** — 利用者向けとオーナー向けの入口
- **オーナー画面**(Phase 3) — 売上・利用状況・受付スイッチ・区画・利用履歴・トラブル報告
- **運営者の管理画面**(Phase 4) — オーナー審査・駐輪場審査・利用の確認と強制終了・トラブル対応

決済(Phase 2)はまだ入っていないため、利用終了時に金額を確定するところまでを行う。

## 技術構成

Next.js (App Router) / TypeScript / Tailwind CSS / PostgreSQL (Supabase互換) / Stripe (Phase 2)

## 必要なもの

- Node.js 22 以上
- PostgreSQL 16 — Docker Desktop があれば同梱の `docker-compose.yml` で立てられる

## セットアップ

プロジェクトのフォルダで、以下の2つを順に実行する。

```bash
npm install
npm run init
```

`npm run init` がまとめてやること。

1. `.env.local` を作る(`AUTH_SECRET` は自動生成)
2. Docker で PostgreSQL を起動して、接続できるまで待つ
3. スキーマを作る
4. デモデータ(天神・大名・今泉の架空3拠点)を入れる

最後に各区画のQR URLと、オーナー画面・管理画面のログイン情報が表示される。
QR URLをブラウザで開けば、現地でQRを読んだのと同じ状態になる。

## 起動

```bash
npm run dev
```

http://localhost:3000 を開く。

| やりたいこと | 行き先 |
| --- | --- |
| サービス紹介を見る | http://localhost:3000 |
| 設置場所から区画のQRをたどる | http://localhost:3000/spots |
| オーナー画面 | http://localhost:3000/owner |
| 管理画面 | http://localhost:3000/admin |

## Windows で動かす

PowerShell での手順。パスは例。

```powershell
cd "C:\Users\jinji\code\プロジェクト\Jin_Web\PITTO"
npm install
npm run init
npm run dev
```

Docker Desktop を起動してから `npm run init` を実行すること。
起動していないと手順2で「docker daemon に接続できない」と出る。

まだソースを置いていない場合は、`scripts/install-windows.ps1` が
ダウンロードから `npm run init` までをまとめて行う。Git がなくても使える。

```powershell
.\scripts\install-windows.ps1 -Dest "C:\Users\jinji\code\プロジェクト\Jin_Web\PITTO"
```

## Docker を使わない場合

PostgreSQL を自分で用意して、`.env.local` の `DATABASE_URL` をそのDBに向ける。
Supabase のプロジェクトでもよい(Project Settings → Database の接続文字列)。

```bash
npm run setup        # .env.local を作る
# .env.local の DATABASE_URL を書き換える
npm run db:migrate
npm run db:seed
```

## データベースの操作

```bash
npm run db:up        # PostgreSQL を起動
npm run db:down      # 止める(データは残る)
npm run db:reset     # スキーマを作り直してデモデータを入れ直す
```

## 画面

### 利用者(ログイン不要)

| URL | 内容 |
| --- | --- |
| `/` | サービス紹介 |
| `/spots` | 設置済みPITTOの一覧 |
| `/l/[id]` | 区画一覧と各区画のQR |
| `/s/[token]` | 区画QRの着地ページ。場所・区画・料金・利用ボタン |
| `/session/[id]` | 利用中。開始時刻・経過・現在料金 |
| `/session/[id]/done` | 完了。確定金額 |
| `/report/[token]` | 無断駐輪・出庫忘れの報告 |
| `/api/qr/[token]` | 区画QRのPNG |

### オーナー・運営者(ログインが必要)

| URL | 内容 |
| --- | --- |
| `/login` | ログイン |
| `/owner` | 本日の売上 / 利用中 / 今月売上 / 受付スイッチ |
| `/owner/[locationId]` | 区画・トラブル報告・利用履歴 |
| `/admin` | 要対応の件数と全体の状況 |
| `/admin/owners` | オーナーの承認・停止 |
| `/admin/locations` | 駐輪場の公開・非公開・強制停止 |
| `/admin/sessions` | 利用の一覧と強制終了 |
| `/admin/incidents` | トラブル報告の対応 |

`npm run db:seed` が開発用のログインを作る。

| 画面 | メール | パスワード |
| --- | --- | --- |
| オーナー | `owner@pitto.example` | `pitto-owner` |
| 管理 | `staff@pitto.example` | `pitto-staff` |

これは開発用の固定値なので、本番のデータベースには入れないこと。

## テスト

```bash
npm test          # 料金計算とトークン生成のユニットテスト
npm run typecheck
```

E2Eは実際のデータベースとブラウザを使う。初回だけブラウザの取得が必要。

```bash
npx playwright install chromium   # 初回のみ
npm run db:reset                  # 状態を揃える
npm run e2e
```

E2Eが確認しているのは以下。

利用者フロー

- QRから利用を開始して終了できる (ケース1、決済を除く)
- 2人が同時に同じ区画を開始しても片方だけ成功する (ケース2)
- 無断駐輪を報告できる (ケース4、写真なし)
- 受付停止中は新規利用できないが、進行中の利用は終了できる (ケース6)
- 推測しやすいIDでは区画を開けない (§34)

紹介ページ・オーナー・管理

- 紹介ページに利用者向けとオーナー向けの入口がある
- 未ログインではオーナー画面と管理画面に入れない
- オーナーは管理画面に入れない
- オーナーが売上と利用状況を確認し、受付を停止・再開できる
- 運営が要対応の件数から各画面へたどれる
- 運営が駐輪場を強制停止すると新規利用できなくなる
- 運営がトラブル報告を対応済みにできる
- 運営が出庫忘れの利用を強制終了できる

## 詰まりやすいところ

**`npm run init` が docker のところで止まる**

Docker Desktop が起動していない。起動してから `npm run db:up` を実行し、
続けて `npm run db:migrate` と `npm run db:seed` を実行する。

**ポート 5432 がすでに使われている**

別の PostgreSQL が動いている。`docker-compose.yml` の `ports` を `"5433:5432"` に変え、
`.env.local` の `DATABASE_URL` も 5433 に合わせる。

**`AUTH_SECRET が未設定か短すぎます` と出る**

`.env.local` がないか、`AUTH_SECRET` が置き換えられていない。`npm run setup` で作り直す。

**`npm run build` が `Cannot read properties of null (reading 'useContext')` で失敗する**

`next build` と `next start` は `NODE_ENV=production` を前提とする。
シェルに `NODE_ENV=development` が残っていると、Next.js内部ページのプリレンダリングで落ちる。
通常の環境では起きないが、起きた場合は `NODE_ENV` を消してから実行する。

```powershell
Remove-Item Env:NODE_ENV   # PowerShell
```

## 設計上の注意

- 料金は必ずサーバー側で確定させる。利用中画面に出る金額は端末時計から計算した目安。
- `.env.local` はコミットしない(`.gitignore` 済み)。`AUTH_SECRET` は環境ごとに変える。
