# PITTO

> ※仮称。商標・ドメイン確認前のため名称は暫定。

「空いている場所に、その場でサッと停める」
予約不要・設備不要のマイクロ駐輪場プラットフォーム。

利用者は現地の区画QRを読むだけで停められる。アプリのインストールも予約も要らない。
オーナーは余っている数㎡を登録し、QRを貼るだけで小さなコイン駐輪場にできる。

- コンセプトの詳細: [docs/concept.md](docs/concept.md)
- データ構造とセキュリティ: [docs/data-model.md](docs/data-model.md)
- フェーズと現状: [docs/roadmap.md](docs/roadmap.md)

現在は **Phase 1(QR生成 → QR読み込み → 利用開始 → 利用終了)** まで動く。
決済(Phase 2)はまだ入っていないため、利用終了時に金額を確定するところまでを行う。

## 技術構成

Next.js (App Router) / TypeScript / Tailwind CSS / PostgreSQL (Supabase互換) / Stripe (Phase 2)

## セットアップ

### 1. 依存関係

```bash
npm install
```

### 2. データベース

PostgreSQL を用意して接続先を書く。Supabase のプロジェクトでも、ローカルのPostgreSQLでもよい。

```bash
cp .env.example .env.local
# .env.local の DATABASE_URL を編集する
```

スキーマとデモデータを入れる。

```bash
npm run db:migrate   # スキーマ作成
npm run db:seed      # 天神・大名・今泉の架空3拠点を作成
```

`db:seed` は各区画のQR URLを出力する。これをブラウザで開けば、QRを読んだのと同じ状態になる。

作り直すときは `npm run db:reset`。

### 3. 起動

```bash
npm run dev
# http://localhost:3000
```

## 画面

| URL | 内容 |
| --- | --- |
| `/` | 設置済みPITTOの一覧 |
| `/l/[id]` | 区画一覧と各区画のQR |
| `/s/[token]` | 区画QRの着地ページ。場所・区画・料金・利用ボタン |
| `/session/[id]` | 利用中。開始時刻・経過・現在料金 |
| `/session/[id]/done` | 完了。確定金額 |
| `/report/[token]` | 無断駐輪・出庫忘れの報告 |
| `/api/qr/[token]` | 区画QRのPNG |

## テスト

```bash
npm test        # 料金計算とトークン生成のユニットテスト
npm run e2e     # §38 の必須テストをブラウザ操作で確認
npm run typecheck
```

E2Eは実際のデータベースを使う。事前に `npm run db:reset` で状態を揃えてから実行する。

E2Eが確認しているのは以下。

- QRから利用を開始して終了できる (ケース1、決済を除く)
- 2人が同時に同じ区画を開始しても片方だけ成功する (ケース2)
- 無断駐輪を報告できる (ケース4、写真なし)
- 受付停止中は新規利用できないが、進行中の利用は終了できる (ケース6)
- 推測しやすいIDでは区画を開けない (§34)

## 注意点

- `next build` と `next start` は `NODE_ENV=production` を前提とする。
  シェルに `NODE_ENV=development` が残っていると、Next.js内部ページのプリレンダリングが
  `Cannot read properties of null (reading 'useContext')` で失敗する。
  その場合は `NODE_ENV=production npm run build` のように明示する。
- 料金は必ずサーバー側で確定させる。利用中画面に出る金額は端末時計から計算した目安。
