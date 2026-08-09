import { expect, test } from "@playwright/test";

import {
  countIncidents,
  countOpenSessions,
  setAccepting,
  spaceStatus,
  sql,
  takeFreeSpace,
} from "./helpers";

test.afterAll(async () => {
  await sql.end();
});

/**
 * §38 ケース1(Phase 1 の範囲)
 * QR → 利用開始 → 利用終了 まで。決済は Phase 2 で追加する。
 */
test("QRから利用を開始して終了できる", async ({ page }) => {
  const space = await takeFreeSpace("PITTO 天神ビル横");

  await page.goto(`/s/${space.token}`);

  // §8 区画QRの画面に出るのは 場所・区画・料金・ボタンだけ。
  await expect(page.getByRole("heading", { name: space.locationName })).toBeVisible();
  await expect(page.getByText(space.spaceNumber, { exact: true })).toBeVisible();
  await expect(page.getByText("60分100円")).toBeVisible();
  await expect(page.getByText("500円")).toBeVisible();

  await page.getByRole("button", { name: "この区画を利用する" }).click();

  // §12 利用中画面
  await expect(page).toHaveURL(/\/session\/[0-9a-f-]{36}$/);
  await expect(page.getByText("利用中")).toBeVisible();
  await expect(page.getByText("経過")).toBeVisible();
  await expect(page.getByText("現在料金")).toBeVisible();

  expect(await spaceStatus(space.token)).toBe("ACTIVE");
  expect(await countOpenSessions(space.token)).toBe(1);

  await page.getByRole("button", { name: "利用を終了する" }).click();

  // §13 完了画面。無料時間内なので0円で確定する。
  await expect(page).toHaveURL(/\/session\/[0-9a-f-]{36}\/done$/);
  await expect(page.getByRole("heading", { name: "利用が完了しました" })).toBeVisible();
  await expect(page.getByText("0円")).toBeVisible();

  expect(await spaceStatus(space.token)).toBe("FREE");
  expect(await countOpenSessions(space.token)).toBe(0);
});

/**
 * §38 ケース2
 * 2人が同じ区画を同時に開始しようとしても、成功するのは片方だけ。
 */
test("同一区画への同時利用は片方だけ成功する", async ({ browser }) => {
  const space = await takeFreeSpace("PITTO 大名店舗横");

  // Cookie を共有しない2つのコンテキスト = 別々の利用者。
  const contexts = await Promise.all([browser.newContext(), browser.newContext()]);
  const pages = await Promise.all(contexts.map((context) => context.newPage()));

  await Promise.all(pages.map((page) => page.goto(`/s/${space.token}`)));

  await Promise.all(
    pages.map((page) => page.getByRole("button", { name: "この区画を利用する" }).click()),
  );

  await Promise.all(pages.map((page) => page.waitForLoadState("networkidle")));

  const onSession = pages.filter((page) => /\/session\//.test(page.url()));
  expect(onSession).toHaveLength(1);

  // Next.js のルートアナウンサーも role="alert" を持つため、文言で絞り込む。
  const rejected = pages.find((page) => !/\/session\//.test(page.url()));
  await expect(rejected!.getByText("この区画はすでに利用中です。")).toBeVisible();

  // DB 側でも開いているセッションは1件だけ。
  expect(await countOpenSessions(space.token)).toBe(1);

  await onSession[0].getByRole("button", { name: "利用を終了する" }).click();
  await expect(onSession[0]).toHaveURL(/\/done$/);

  await Promise.all(contexts.map((context) => context.close()));
});

/**
 * §38 ケース4
 * 空きと表示されている区画に無断駐輪がある場合、利用者が報告できる。
 * 写真の添付は Phase 5。
 */
test("無断駐輪を報告できる", async ({ page }) => {
  const space = await takeFreeSpace("PITTO 今泉マンション前");
  const before = await countIncidents(space.token);

  await page.goto(`/report/${space.token}`);
  await page.getByRole("radio", { name: /自転車が停まっている/ }).check();
  await page.getByRole("textbox").fill("QRのない自転車が停まっています");
  await page.getByRole("button", { name: "報告する" }).click();

  await expect(page.getByRole("heading", { name: "報告を受け付けました" })).toBeVisible();
  // §15 報告だけでは区画の状態を変えない。
  await expect(page.getByText("区画の状態はその場では変わりません")).toBeVisible();

  expect(await countIncidents(space.token)).toBe(before + 1);
  expect(await spaceStatus(space.token)).toBe("FREE");
});

/**
 * §38 ケース6
 * オーナーが受付を停止したら新規の利用開始はできない。
 * ただし進行中の利用は終了できる。
 */
test("受付停止中は新規利用できないが、進行中の利用は終了できる", async ({ page }) => {
  const space = await takeFreeSpace("PITTO 天神ビル横");

  await page.goto(`/s/${space.token}`);
  await page.getByRole("button", { name: "この区画を利用する" }).click();
  await expect(page).toHaveURL(/\/session\//);
  const sessionUrl = page.url();

  await setAccepting(space.locationId, false);

  try {
    // 別の空き区画では新規に開始できない。
    const another = await takeFreeSpace("PITTO 天神ビル横");
    await page.goto(`/s/${another.token}`);
    await expect(page.getByText("この駐輪場は現在受付を停止しています。")).toBeVisible();
    await expect(page.getByRole("button", { name: "この区画を利用する" })).toHaveCount(0);

    // 停止中でも進行中の利用は終了できる。
    await page.goto(sessionUrl);
    await page.getByRole("button", { name: "利用を終了する" }).click();
    await expect(page).toHaveURL(/\/done$/);
  } finally {
    await setAccepting(space.locationId, true);
  }

  expect(await countOpenSessions(space.token)).toBe(0);
});

/** §34 連番IDでは区画にたどり着けない。 */
test("推測しやすいIDでは区画を開けない", async ({ page }) => {
  for (const path of ["/s/1", "/s/123", "/s/TNJ001-03"]) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(404);
  }
});
