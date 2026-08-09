import { describe, expect, it } from "vitest";

import {
  calculateFeeJpy,
  calculateSessionFeeJpy,
  elapsedMinutes,
  formatDuration,
  type PricingRule,
} from "./pricing";

/** §37 天神ビル横: 60分100円 / 24時間最大500円 */
const TENJIN: PricingRule = {
  baseMinutes: 60,
  basePriceJpy: 100,
  dailyCapJpy: 500,
  graceMinutes: 5,
};

/** §37 今泉マンション前: 120分100円 / 24時間最大400円 */
const IMAIZUMI: PricingRule = {
  baseMinutes: 120,
  basePriceJpy: 100,
  dailyCapJpy: 400,
  graceMinutes: 5,
};

describe("elapsedMinutes", () => {
  it("開始済みの分を切り上げる", () => {
    const start = new Date("2026-01-01T10:00:00Z");
    expect(elapsedMinutes(start, new Date("2026-01-01T11:00:00Z"))).toBe(60);
    expect(elapsedMinutes(start, new Date("2026-01-01T11:00:01Z"))).toBe(61);
  });

  it("終了が開始より前でも負にならない", () => {
    const start = new Date("2026-01-01T10:00:00Z");
    expect(elapsedMinutes(start, new Date("2026-01-01T09:00:00Z"))).toBe(0);
  });
});

describe("calculateFeeJpy", () => {
  it("無料時間内は0円", () => {
    expect(calculateFeeJpy(0, TENJIN)).toBe(0);
    expect(calculateFeeJpy(5, TENJIN)).toBe(0);
  });

  it("無料時間を1分でも超えたら1単位分かかる", () => {
    expect(calculateFeeJpy(6, TENJIN)).toBe(100);
  });

  it("単位時間ぴったりでは次の単位に進まない", () => {
    expect(calculateFeeJpy(60, TENJIN)).toBe(100);
    expect(calculateFeeJpy(61, TENJIN)).toBe(200);
  });

  it("24時間以内は上限で頭打ちになる", () => {
    expect(calculateFeeJpy(300, TENJIN)).toBe(500); // 5単位=500円
    expect(calculateFeeJpy(360, TENJIN)).toBe(500); // 6単位=600円 → 上限500円
    expect(calculateFeeJpy(1439, TENJIN)).toBe(500);
  });

  it("24時間ごとに上限が加算される", () => {
    expect(calculateFeeJpy(1440, TENJIN)).toBe(500); // ちょうど24時間
    expect(calculateFeeJpy(1500, TENJIN)).toBe(600); // 24時間 + 1時間
    expect(calculateFeeJpy(1800, TENJIN)).toBe(1000); // 24時間 + 6時間(上限)
    expect(calculateFeeJpy(2880, TENJIN)).toBe(1000); // ちょうど48時間
  });

  it("単位時間が異なる料金設定でも同じ規則で計算する", () => {
    expect(calculateFeeJpy(120, IMAIZUMI)).toBe(100);
    expect(calculateFeeJpy(121, IMAIZUMI)).toBe(200);
    expect(calculateFeeJpy(600, IMAIZUMI)).toBe(400); // 5単位=500円 → 上限400円
    expect(calculateFeeJpy(1560, IMAIZUMI)).toBe(500); // 24時間 + 2時間
  });

  it("無料時間0の設定では開始直後から課金される", () => {
    const noGrace: PricingRule = { ...TENJIN, graceMinutes: 0 };
    expect(calculateFeeJpy(0, noGrace)).toBe(0);
    expect(calculateFeeJpy(1, noGrace)).toBe(100);
  });
});

describe("calculateSessionFeeJpy", () => {
  it("開始・終了時刻から直接求められる", () => {
    const started = new Date("2026-01-01T14:21:00Z");
    const ended = new Date("2026-01-01T15:33:00Z"); // 1時間12分
    expect(calculateSessionFeeJpy(started, ended, TENJIN)).toBe(200);
  });
});

describe("formatDuration", () => {
  it("日・時間・分を省略しながら組み立てる", () => {
    expect(formatDuration(0)).toBe("0分");
    expect(formatDuration(45)).toBe("45分");
    expect(formatDuration(60)).toBe("1時間");
    expect(formatDuration(72)).toBe("1時間12分");
    expect(formatDuration(1440)).toBe("1日");
    expect(formatDuration(1512)).toBe("1日1時間12分");
  });
});
