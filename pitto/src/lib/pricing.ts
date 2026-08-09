/**
 * 料金計算。
 *
 * §13 のとおりこの計算はサーバー側だけで行い、クライアントから送られた金額は一切信用しない。
 * 表示用に同じ関数をクライアントでも使うが、確定額は必ずサーバーの結果を採用する。
 */

export type PricingRule = {
  /** 課金単位(分)。例: 60 */
  baseMinutes: number;
  /** 1単位あたりの料金(円)。例: 100 */
  basePriceJpy: number;
  /** 24時間ごとの上限(円)。例: 500 */
  dailyCapJpy: number;
  /** 誤スキャン救済のための無料時間(分)。この時間内に終了すれば0円。 */
  graceMinutes: number;
};

const MINUTES_PER_DAY = 24 * 60;
const MS_PER_MINUTE = 60_000;

/**
 * 経過ミリ秒を「開始済みの分数」に変換する。
 * 60分00秒は60分、60分01秒は61分として扱う。
 */
export function elapsedMinutes(startedAt: Date, endedAt: Date): number {
  const ms = endedAt.getTime() - startedAt.getTime();
  if (ms <= 0) return 0;
  return Math.ceil(ms / MS_PER_MINUTE);
}

/**
 * 経過分数から料金を求める。
 *
 * 24時間ごとに上限を適用し、端数の時間には単位料金を適用したうえで
 * その端数分にも上限を掛ける(日本のコインパーキングと同じ考え方)。
 */
export function calculateFeeJpy(minutes: number, rule: PricingRule): number {
  if (minutes <= 0) return 0;
  if (minutes <= rule.graceMinutes) return 0;

  const fullDays = Math.floor(minutes / MINUTES_PER_DAY);
  const remainderMinutes = minutes - fullDays * MINUTES_PER_DAY;

  const remainderUnits = Math.ceil(remainderMinutes / rule.baseMinutes);
  const remainderFee = Math.min(remainderUnits * rule.basePriceJpy, rule.dailyCapJpy);

  return fullDays * rule.dailyCapJpy + remainderFee;
}

/** 開始・終了時刻から直接料金を求める。 */
export function calculateSessionFeeJpy(
  startedAt: Date,
  endedAt: Date,
  rule: PricingRule,
): number {
  return calculateFeeJpy(elapsedMinutes(startedAt, endedAt), rule);
}

/** 「1時間12分」のような表示に変換する。 */
export function formatDuration(minutes: number): string {
  if (minutes <= 0) return "0分";
  const days = Math.floor(minutes / MINUTES_PER_DAY);
  const hours = Math.floor((minutes % MINUTES_PER_DAY) / 60);
  const mins = minutes % 60;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}日`);
  if (hours > 0) parts.push(`${hours}時間`);
  if (mins > 0 || parts.length === 0) parts.push(`${mins}分`);
  return parts.join("");
}

/** 「100円」のような表示に変換する。 */
export function formatYen(amount: number): string {
  return `${amount.toLocaleString("ja-JP")}円`;
}

/** 「60分100円 / 24時間最大500円」のような料金表記を作る。 */
export function formatPricingRule(rule: PricingRule): string {
  return `${rule.baseMinutes}分${rule.basePriceJpy}円 / 24時間最大${rule.dailyCapJpy}円`;
}
