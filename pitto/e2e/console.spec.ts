import { expect, test, type Page } from "@playwright/test";

import {
  closeDb,
  countOpenSessions,
  DEMO_OWNER,
  DEMO_STAFF,
  incidentStatus,
  isAccepting,
  locationStatus,
  setAccepting,
  takeFreeSpace,
} from "./helpers";

test.afterAll(async () => {
  await closeDb();
});

async function login(page: Page, account: { email: string; password: string }): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("メールアドレス").fill(account.email);
  await page.getByLabel("パスワード").fill(account.password);
  await page.getByRole("button", { name: "ログイン" }).click();
  // 認証が済むまで待つ。待たずに次のページへ進むと未ログイン扱いで弾かれる。
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

test.describe("サービス紹介ページ", () => {
  test("コンセプトと両方の入口が載っている", async ({ page }) => {
    await page.goto("/");

    // 見出しは <br> で改行しているため、アクセシブル名には空白が入る。
    await expect(
      page.getByRole("heading", { name: /空いている場所に、\s*その場でサッと停める。/ }),
    ).toBeVisible();
    await expect(page.getByText("予約なし")).toBeVisible();
    await expect(page.getByText("アプリなし")).toBeVisible();
    await expect(page.getByText("駐輪機なし")).toBeVisible();

    // §18 オーナーへの訴求は「駐輪場経営」ではなく「余っている3㎡」。
    await expect(page.getByRole("heading", { name: /余っている3㎡を貸してください/ })).toBeVisible();

    await page.getByRole("link", { name: "設置場所を見る" }).click();
    await expect(page).toHaveURL(/\/spots$/);
    await expect(page.getByRole("heading", { name: "設置場所" })).toBeVisible();
  });
});

test.describe("アクセス制御", () => {
  test("未ログインではオーナー画面と管理画面に入れない", async ({ page }) => {
    await page.goto("/owner");
    await expect(page).toHaveURL(/\/login/);

    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login/);
  });

  test("オーナーは管理画面に入れない", async ({ page }) => {
    await login(page, DEMO_OWNER);
    await expect(page).toHaveURL(/\/owner$/);

    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login\?error=not_staff/);
  });
});

test.describe("オーナー画面", () => {
  test("売上と利用状況を確認し、受付を停止できる", async ({ page }) => {
    const space = await takeFreeSpace("PITTO 大名店舗横");

    // 利用中の台数が出ることを確かめたいので、先に1台停めておく。
    await page.goto(`/s/${space.token}`);
    await page.getByRole("button", { name: "この区画を利用する" }).click();
    await expect(page).toHaveURL(/\/session\//);

    await login(page, DEMO_OWNER);
    await expect(page).toHaveURL(/\/owner$/);

    // §25 最初の画面だけで本日の売上・利用中・今月売上が分かる。
    await expect(page.getByText("本日の売上")).toBeVisible();
    await expect(page.getByText("今月売上")).toBeVisible();
    await expect(page.getByText("現在利用中")).toBeVisible();

    const card = page.locator("li").filter({ hasText: space.locationName });
    await expect(card.getByText("受付中")).toBeVisible();

    // §21 一時停止はスイッチひとつ。
    await card.getByRole("button", { name: "受付を停止する" }).click();
    await expect(card.getByRole("button", { name: "受付を再開する" })).toBeVisible();
    expect(await isAccepting(space.locationId)).toBe(false);

    await card.getByRole("button", { name: "受付を再開する" }).click();
    await expect(card.getByRole("button", { name: "受付を停止する" })).toBeVisible();
    expect(await isAccepting(space.locationId)).toBe(true);

    // 詳細では区画ごとの状態と利用履歴が見られる。
    await page.getByRole("link", { name: space.locationName }).click();
    await expect(page).toHaveURL(/\/owner\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { name: space.locationName })).toBeVisible();
    await expect(page.getByText("利用履歴")).toBeVisible();
    await expect(page.getByText("利用中").first()).toBeVisible();
  });

  test("他人の駐輪場の詳細は開けない", async ({ page }) => {
    const space = await takeFreeSpace("PITTO 今泉マンション前");
    await login(page, DEMO_STAFF);

    // 運営者はオーナー登録がないため、オーナー画面自体に入れない。
    const response = await page.goto(`/owner/${space.locationId}`);
    expect(response?.url()).toMatch(/\/login/);
  });
});

test.describe("管理画面", () => {
  test("要対応の件数から各画面へたどれる", async ({ page }) => {
    await login(page, DEMO_STAFF);
    await expect(page).toHaveURL(/\/admin$/);

    await expect(page.getByText("要対応")).toBeVisible();
    await expect(page.getByRole("link", { name: /オーナーの審査/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /駐輪場の審査/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /未対応のトラブル報告/ })).toBeVisible();
  });

  test("駐輪場を強制停止すると新規利用できなくなる", async ({ page }) => {
    const space = await takeFreeSpace("PITTO 今泉マンション前");

    await login(page, DEMO_STAFF);
    await page.goto("/admin/locations");

    const card = page.locator("li").filter({ hasText: space.locationName });
    await card.getByRole("button", { name: "強制停止する" }).click();
    // Server Action の反映を待ってからDBを確認する。
    await expect(card.getByText("停止中")).toBeVisible();

    expect(await locationStatus(space.locationId)).toBe("SUSPENDED");
    expect(await isAccepting(space.locationId)).toBe(false);

    try {
      await page.goto(`/s/${space.token}`);
      await expect(page.getByText("この駐輪場は現在公開されていません。")).toBeVisible();
    } finally {
      await page.goto("/admin/locations");
      const restored = page.locator("li").filter({ hasText: space.locationName });
      await restored.getByRole("button", { name: "公開する" }).click();
      await expect(restored.getByText("公開中")).toBeVisible();
      await setAccepting(space.locationId, true);
    }

    expect(await locationStatus(space.locationId)).toBe("PUBLISHED");
  });

  test("トラブル報告を対応済みにできる", async ({ page }) => {
    const space = await takeFreeSpace("PITTO 天神ビル横");

    await page.goto(`/report/${space.token}`);
    await page.getByRole("radio", { name: /自転車が停まっている/ }).check();
    await page.getByRole("textbox").fill("E2E: 無断駐輪の報告");
    await page.getByRole("button", { name: "報告する" }).click();
    await expect(page.getByRole("heading", { name: "報告を受け付けました" })).toBeVisible();

    await login(page, DEMO_STAFF);
    await page.goto("/admin/incidents");

    const card = page.locator("li").filter({ hasText: "E2E: 無断駐輪の報告" });
    // 補足の本文にも「無断駐輪」が含まれるため、種別の表示だけを見る。
    await expect(card.getByText("無断駐輪", { exact: true })).toBeVisible();
    await card.getByRole("button", { name: "対応済みにする" }).click();

    // 対応済みにすると「未対応」の一覧から消える。
    await expect(card).toHaveCount(0);
    expect(await incidentStatus(space.token)).toBe("RESOLVED");
  });

  test("出庫忘れの利用を運営が強制終了できる", async ({ page }) => {
    const space = await takeFreeSpace("PITTO 天神ビル横");

    await page.goto(`/s/${space.token}`);
    await page.getByRole("button", { name: "この区画を利用する" }).click();
    await expect(page).toHaveURL(/\/session\//);
    expect(await countOpenSessions(space.token)).toBe(1);

    await login(page, DEMO_STAFF);
    await page.goto("/admin/sessions?filter=open");

    // 他のテストが残した同じ区画番号を掴まないよう、駐輪場名でも絞り込む。
    const row = page
      .locator("li")
      .filter({ hasText: space.locationName })
      .filter({ hasText: `区画${space.spaceNumber}` });
    await row.getByRole("button", { name: "強制終了" }).click();

    // 終了すると「利用中」の一覧から消える。
    await expect(row).toHaveCount(0);

    // §13 と同じくサーバー側で料金を確定させ、区画は空きに戻る。
    expect(await countOpenSessions(space.token)).toBe(0);
  });
});
