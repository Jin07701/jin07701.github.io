# データ構造

定義は `supabase/migrations/0001_init.sql` にある。素のPostgreSQL SQLなのでSupabaseでもそのまま流せる。

## テーブル一覧 (§31)

| テーブル | 役割 |
| --- | --- |
| `users` | 利用者。§9 のとおり最低限の識別情報のみ |
| `owners` | スペース提供者。審査状態と権利同意を持つ |
| `parking_locations` | 駐輪場。審査状態・受付スイッチ・営業時間 |
| `parking_spaces` | 区画。§32 の構成 |
| `pricing_rules` | 料金。§22 のとおり単位料金と24時間上限だけ |
| `qr_tokens` | QRトークンの発行履歴。再発行しても追跡できる |
| `parking_sessions` | 利用セッション。§33 の状態遷移 |
| `payments` | 決済。冪等キーとStripeのIDを持つ |
| `payouts` | オーナーへの分配。手数料率を明細に残す |
| `incident_reports` | トラブル報告。§15/§16 |
| `parking_images` | 駐輪場写真と報告写真 |
| `audit_logs` | 操作履歴 (§34) |

## 状態

```
space_status     : FREE | ACTIVE | FLAGGED
session_status   : PENDING | ACTIVE | PAYMENT_PENDING | COMPLETED | FLAGGED
location_status  : DRAFT | PENDING_REVIEW | PUBLISHED | SUSPENDED
owner_status     : PENDING_REVIEW | APPROVED | SUSPENDED
```

`PAYMENT_PENDING` があることで、決済失敗や異常終了から復旧できる (§33)。

## セキュリティ上の作り (§34)

| 要件 | 実装 |
| --- | --- |
| QRに連番IDを入れない | `parking_spaces.qr_token` は24文字のランダム値。`/space/123` の形は存在しない |
| 料金はDBから取得 | `pricing_rules` を `parking_sessions.pricing_rule_id` で固定して参照 |
| 開始・終了時刻はサーバー時刻 | `now()` のみを使用。クライアントの時刻は受け取らない |
| 決済は冪等 | `payments.idempotency_key` に一意制約 |
| 同一区画で ACTIVE を複数作れない | `parking_sessions` の部分ユニークインデックス |
| Stripe Webhookを正とする | `payments.stripe_payment_intent_id` に一意制約 (Phase 2で使用) |
| 操作履歴を残す | `audit_logs` |

同時利用の排他は、アプリ側の事前チェックではなく **DBの部分ユニークインデックス**で担保している。

```sql
create unique index parking_sessions_one_open_per_space
  on parking_sessions (parking_space_id)
  where status in ('PENDING', 'ACTIVE', 'PAYMENT_PENDING');
```

競合した側のトランザクションは一意制約違反(23505)で落ち、
アプリはそれを「この区画はすでに利用中です」として返す。
決済待ちも区画を占有し続けるため対象に含めている。

## 料金計算

`src/lib/pricing.ts` にまとめてある。

```
経過分 = ceil((終了 - 開始) / 60秒)
無料時間以内            → 0円
24時間ごと              → 上限額を加算
端数                    → ceil(端数 / 単位分) × 単位料金 (ただし上限額で頭打ち)
```

例: 60分100円 / 24時間最大500円 の場合

| 経過 | 料金 |
| --- | --- |
| 5分 | 0円 (無料時間) |
| 60分 | 100円 |
| 61分 | 200円 |
| 6時間 | 500円 (上限) |
| 25時間 | 600円 |
| 30時間 | 1,000円 |

## 仕様との差

- **無料時間 (`pricing_rules.grace_minutes`, 既定5分)** は仕様にない追加項目。
  誤ってQRを読んだだけの利用者に課金しないために入れている。0にすれば無効化できる。
- **区画URLの形式**: §8 の例は `pitto.jp/s/TNJ001-03` だが、これは §34 の
  「推測困難なtokenを使用する」と両立しない。§34 を優先し、ランダムなトークンにしている。
