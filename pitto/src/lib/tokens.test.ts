import { describe, expect, it } from "vitest";

import { generateQrToken, isValidQrTokenFormat } from "./tokens";

describe("generateQrToken", () => {
  it("既定で24文字を返す", () => {
    expect(generateQrToken()).toHaveLength(24);
  });

  it("紛らわしい文字(I/L/O/U)を含まない", () => {
    for (let i = 0; i < 200; i += 1) {
      expect(generateQrToken()).not.toMatch(/[ILOU]/);
    }
  });

  it("連番にならない", () => {
    const tokens = new Set(Array.from({ length: 500 }, () => generateQrToken()));
    expect(tokens.size).toBe(500);
  });

  it("短すぎる長さは拒否する", () => {
    expect(() => generateQrToken(8)).toThrow();
  });
});

describe("isValidQrTokenFormat", () => {
  it("生成したトークンを受け入れる", () => {
    expect(isValidQrTokenFormat(generateQrToken())).toBe(true);
  });

  it("§34 で禁止している連番IDを弾く", () => {
    expect(isValidQrTokenFormat("123")).toBe(false);
    expect(isValidQrTokenFormat("TNJ001-03")).toBe(false);
  });

  it("小文字や記号を弾く", () => {
    expect(isValidQrTokenFormat("abcdefghijklmnopqrstuvwx")).toBe(false);
    expect(isValidQrTokenFormat("ABCDEFGH-JKMNPQRS/VWXYZ0")).toBe(false);
  });
});
