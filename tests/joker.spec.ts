import { test, expect, Page } from "@playwright/test";
import { acceptTerms } from "./helpers";

/**
 * The Joker button: stamp an unidentified rider's arrival time+order instantly
 * (a bunch finish where bibs can't be read fast enough), resolve it to a real
 * bib afterward. Opt-in via the side menu, off by default.
 *
 * Same fake-clock approach as lap-recording.spec.ts: the 60s minimum between
 * laps and the 300ms tap-disambiguation timer both make real time unusable.
 */

const card = (page: Page, bib: number) => page.locator(`[data-testid="racing-rider-${bib}"]`);
const jokerCard = (page: Page, seq: number) => page.locator(`[data-testid="joker-card-${seq}"]`);

/** Tap once and let the fake clock clear the single/double-tap window. */
async function tap(page: Page, bib: number) {
  await card(page, bib).click();
  await page.clock.fastForward(400);
}

async function lapsOf(page: Page, bib: number): Promise<number> {
  const attr = (await card(page, bib).getAttribute("data-laps")) ?? "";
  return Number(attr.split("/")[0]);
}

/** Flip the side-menu "Joker button" checkbox on, from /main. */
async function enableJokerMode(page: Page) {
  await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("checkbox", { name: /Show Joker button/i }).check();
  await page.getByRole("button", { name: "Close menu" }).click();
}

async function openLiveDemo(page: Page) {
  await page.goto("/main");
  await acceptTerms(page);
  await page.getByRole("button", { name: /Try Demo Race/i }).click();
  await page.waitForURL(/\/race\/demo-race-99001/);
  // The demo's one-shot onboarding lands us on Live; make sure we're there.
  await expect(async () => {
    if (!/\/heat\//.test(page.url())) {
      await page.getByRole("tab", { name: "Live", exact: true }).click();
    }
    await expect(page.locator('[data-testid^="racing-rider-"]').first()).toBeVisible({
      timeout: 2_000,
    });
  }).toPass({ timeout: 20_000 });
}

/** A bib with at least `spare` laps still to run, so taps record laps instead
 * of finishing the rider and removing their card. */
async function racingBibWithLapsLeft(page: Page, spare: number): Promise<number> {
  const cards = await page
    .locator('[data-testid^="racing-rider-"]')
    .evaluateAll((els) =>
      els.map((el) => {
        const e = el as HTMLElement;
        return { testid: e.dataset.testid ?? "", laps: e.dataset.laps ?? "" };
      })
    );
  for (const c of cards) {
    const [done, total] = c.laps.split("/").map(Number);
    if (Number.isFinite(done) && Number.isFinite(total) && total - done >= spare) {
      return Number(c.testid.replace("racing-rider-", ""));
    }
  }
  throw new Error(`No racing rider with ${spare} laps left. Cards: ${JSON.stringify(cards)}`);
}

test.describe("Joker button", () => {
  test("stays hidden until enabled in the side menu", async ({ page }) => {
    await page.clock.install({ time: new Date("2026-07-21T09:00:00") });
    await openLiveDemo(page);
    await expect(page.getByRole("button", { name: "Add Joker" })).toHaveCount(0);
  });

  test("stamps a Joker and resolves it to a bib using the original captured time, undo works", async ({
    page,
  }) => {
    await page.clock.install({ time: new Date("2026-07-21T09:00:00") });
    await page.goto("/main");
    await acceptTerms(page);
    await enableJokerMode(page);
    await openLiveDemo(page);

    const bib = await racingBibWithLapsLeft(page, 2);
    const before = await lapsOf(page, bib);

    // Let real race time pass before stamping — this is the whole point: the
    // eventual lap must land at THIS moment, not when it's resolved later.
    await page.clock.fastForward(90 * 1000);
    await page.getByRole("button", { name: "Add Joker" }).click();
    await expect(jokerCard(page, 1)).toBeVisible();
    await expect(page.getByText("🃏 Unresolved (1)")).toBeVisible();

    // Resolve several minutes "later" — proves the recorded lap uses the
    // captured time, not the (much later) resolve time.
    await page.clock.fastForward(5 * 60 * 1000);
    await jokerCard(page, 1).click();
    await expect(page.getByText("Joker #1")).toBeVisible();
    await page.getByPlaceholder("Bib #").fill(String(bib));
    await page.getByRole("button", { name: "Save", exact: true }).click();

    // Joker is gone, the rider's lap count advanced exactly once.
    await expect(jokerCard(page, 1)).toHaveCount(0);
    await expect(page.getByText(/Unresolved/)).toHaveCount(0);
    expect(await lapsOf(page, bib)).toBe(before + 1);

    // Revert Last Lap undoes a Joker-originated lap exactly like a normal one —
    // it rides the same action log, no special-case undo code.
    await card(page, bib).dblclick();
    await expect(page.getByText("Note / Comment")).toBeVisible();
    await page.getByRole("button", { name: /Revert Last Lap/ }).click();
    expect(await lapsOf(page, bib)).toBe(before);
  });

  test("blocks resolving a Joker to a bib with a more recent lap already recorded", async ({
    page,
  }) => {
    await page.clock.install({ time: new Date("2026-07-21T09:00:00") });
    await page.goto("/main");
    await acceptTerms(page);
    await enableJokerMode(page);
    await openLiveDemo(page);

    const bib = await racingBibWithLapsLeft(page, 2);

    // Stamp a Joker, then record a REAL lap for the same rider afterward — the
    // Joker is now older than the rider's most recent lap.
    await page.getByRole("button", { name: "Add Joker" }).click();
    await page.clock.fastForward(90 * 1000);
    await tap(page, bib);

    const before = await lapsOf(page, bib);

    await jokerCard(page, 1).click();
    await page.getByPlaceholder("Bib #").fill(String(bib));
    await page.getByRole("button", { name: "Save", exact: true }).click();

    // Blocked: modal stays open (still showing this Joker), nothing changed.
    await expect(page.getByText("Joker #1")).toBeVisible();
    await page.getByRole("button", { name: "✕" }).click();
    await expect(jokerCard(page, 1)).toBeVisible();
    expect(await lapsOf(page, bib)).toBe(before);
  });

  test("Delete removes an unresolved Joker without touching any rider", async ({ page }) => {
    await page.clock.install({ time: new Date("2026-07-21T09:00:00") });
    await page.goto("/main");
    await acceptTerms(page);
    await enableJokerMode(page);
    await openLiveDemo(page);

    const bib = await racingBibWithLapsLeft(page, 2);
    const before = await lapsOf(page, bib);

    await page.getByRole("button", { name: "Add Joker" }).click();
    await jokerCard(page, 1).click();
    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await page.getByRole("button", { name: /Tap again to delete/ }).click();

    await expect(jokerCard(page, 1)).toHaveCount(0);
    expect(await lapsOf(page, bib)).toBe(before);
  });
});
