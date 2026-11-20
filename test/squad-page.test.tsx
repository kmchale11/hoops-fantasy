import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/lib/db";
import { listPlayers } from "@/squads/players";
import { auth, form, redirectOf, resetAuth } from "./helpers/auth";
import { createTestDb } from "./helpers/db";
import { addFixture, addManager, addRound, seedLeague, VALID_SQUAD } from "./helpers/league";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", async () => (await import("./helpers/auth")).supabaseServerMock);
vi.mock("@/lib/server-db", async () => (await import("./helpers/auth")).serverDbMock);
const cookieJar = vi.hoisted(() => new Set<string>());
vi.mock("next/headers", () => ({ cookies: async () => ({ has: (name: string) => cookieJar.has(name) }) }));

const { default: SquadPage } = await import("@/app/squad/page");
const { default: SquadBuilder, timeUntil } = await import("@/app/squad/squad-builder");
const { saveSquadAction } = await import("@/app/squad/actions");
const { default: ResultsPage } = await import("@/app/results/page");

const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;

let db: Db;
let now: Date;
const at = (ms: number) => new Date(now.getTime() + ms);

/** React escapes these in HTML. */
const html = (text: string) => text.replace(/&/g, "&amp;").replace(/'/g, "&#x27;");

beforeEach(async () => {
  ({ db } = await createTestDb());
  resetAuth(db);
  await seedLeague(db);
  const niamh = await addManager(db, "Niamh");
  auth.user = { id: niamh, email: "niamh@example.ie" };
  now = new Date();
  await addRound(db, 4, at(-8 * DAY), at(-5 * DAY));
  await addFixture(db, 1, 2, at(-7 * DAY), "final");
  await addRound(db, 5, at(-1 * DAY), at(2 * DAY));
});

describe("squad page", () => {
  it("shows the open round's deadline and the squad's empty slots by position", async () => {
    await addFixture(db, 1, 2, at(26.5 * HOUR));
    const page = renderToStaticMarkup(await SquadPage());
    expect(page).toContain("Round 5 locks");
    expect(page).toContain("locks in 1 day 2 hours");
    expect(page).toContain("Niamh&#x27;s Team");
    for (const group of ["Guards", "Forwards", "Centre", "Flex"]) expect(page).toContain(`>${group}</h2>`);
    expect(page.match(/Add a guard/g)).toHaveLength(2);
    expect(page.match(/Add a forward/g)).toHaveLength(2);
    expect(page.match(/Add a centre/g)).toHaveLength(1);
    expect(page.match(/Add a flex player/g)).toHaveLength(1);
    expect(page).toContain("Pick 6 more to save");
  });

  it("shows a saved squad in its slots, the third guard in flex", async () => {
    await addFixture(db, 1, 2, at(2 * HOUR));
    await saveSquadAction({ errors: [], savedAt: null }, form({ players: VALID_SQUAD.join(","), captain: "5" }));
    const page = renderToStaticMarkup(await SquadPage());
    const group = (name: string) => new RegExp(`>${name}</h2>.*?</ul>`).exec(page)![0];
    expect(group("Guards")).toMatch(/Ballina Player 1.*Killester Player 1/);
    expect(group("Forwards")).toMatch(/Ballina Player 2.*Killester Player 2/);
    expect(group("Centre")).toContain("Moycullen Player 3");
    expect(group("Flex")).toContain("Tralee Player 1");
    expect(group("Flex")).toContain("Guard");
    expect(page).toContain("Save squad");
  });

  it("is read-only while a round is in progress", async () => {
    await addFixture(db, 1, 2, at(-1 * HOUR), "live");
    const page = renderToStaticMarkup(await SquadPage());
    expect(page).toContain("locked at");
    expect(page).not.toMatch(/to save|Save squad/);
  });

  it("suggests How to play until it's been seen", async () => {
    cookieJar.clear();
    expect(renderToStaticMarkup(await SquadPage())).toContain("New here?");
    cookieJar.add("seen-how-to-play");
    expect(renderToStaticMarkup(await SquadPage())).not.toContain("New here?");
  });

  it("sends signed-out visitors to sign in", async () => {
    auth.user = null;
    expect(await redirectOf(() => SquadPage())).toBe("/sign-in?next=%2Fsquad");
  });
});

describe("squad builder", () => {
  it("shows the same rule errors the server returns", async () => {
    await addFixture(db, 1, 2, at(2 * HOUR));
    await db.query(`update player_prices set price = 15.0 where player_id in (1, 2)`);
    const players = await listPlayers(db, null);
    const round = { name: "Round 5", deadline: at(2 * HOUR).toISOString() };

    const cases: [number[], number | null][] = [
      [[1, 2, 3, 4, 5, 9], 1], // over budget, 4 from Ballina, one forward
      [VALID_SQUAD, null], // no captain
    ];
    for (const [ids, captain] of cases) {
      const fromServer = await saveSquadAction(
        { errors: [], savedAt: null },
        form({ players: ids.join(","), captain: captain === null ? "" : String(captain) }),
      );
      expect(fromServer.errors.length).toBeGreaterThan(0);

      const builder = renderToStaticMarkup(
        <SquadBuilder
          players={players}
          initialPlayerIds={ids}
          initialCaptainId={captain}
          open={round}
          locked={null}
          pointsRound={null}
          now={now.toISOString()}
        />,
      );
      const shown = /aria-label="Still to fix">(.*?)<\/ul>/.exec(builder)![1];
      expect(shown).toBe(fromServer.errors.map((e) => `<li>${html(e)}</li>`).join(""));
    }
  });

  it("saves a valid squad", async () => {
    await addFixture(db, 1, 2, at(2 * HOUR));
    const result = await saveSquadAction(
      { errors: [], savedAt: null },
      form({ players: VALID_SQUAD.join(","), captain: "5" }),
    );
    expect(result.errors).toEqual([]);
    expect(result.savedAt).not.toBeNull();
  });

  it("counts down in days, hours and minutes", () => {
    expect(timeUntil(2 * DAY + 3 * HOUR + 59_000)).toBe("2 days 3 hours");
    expect(timeUntil(HOUR + 60_000)).toBe("1 hour 1 minute");
    expect(timeUntil(45 * 60_000)).toBe("45 minutes");
    expect(timeUntil(30_000)).toBe("less than a minute");
  });
});

describe("results page", () => {
  /** Round 4's points: Ballina's guard 20.0 (captain), Killester's guard 7.5. Tralee's game was postponed. */
  async function playRound4() {
    await addFixture(db, 4, 3, at(-6 * DAY), "postponed");
    await db.query(
      `insert into player_fantasy_points (player_id, fixture_id, round_id, points, is_final, calculated_at)
       values (1, 1, 1, 20.0, true, now()), (5, 1, 1, 7.5, true, now())`,
    );
    await db.query(`select save_squad_at($1, $2::bigint[], 1, $3)`, [auth.user!.id, VALID_SQUAD, at(-10 * DAY)]);
    await db.query(`select refresh_user_round_scores()`);
  }
  const results = async (round?: string) =>
    renderToStaticMarkup(await ResultsPage({ searchParams: Promise.resolve(round ? { round } : {}) } as never));

  it("shows the round's points, the captain doubled, and the season total", async () => {
    await playRound4();
    const page = await results("4");
    expect(page).toContain('<span class="eyebrow">Round 4</span>');
    expect(page).toContain('href="/results?round=5"');
    expect(page).toMatch(/<h1[^>]*>47\.5<span[^>]*>points this round/);
    expect(page).toMatch(/Ballina Player 1<span[^>]*>C ×2<\/span>.*?20\.0 × 2.*?>40\.0</);
    expect(page).toMatch(/Round rank.*?#1/);
    expect(page).toMatch(/Season<\/span><span[^>]*>47\.5/);
  });

  it("shows a flex player whose game was postponed scoring 0", async () => {
    await playRound4();
    const page = await results("4");
    expect(page).toMatch(/Tralee Player 1.*?Flex · Guard · game postponed.*?>0\.0</);
  });

  it("opens on the latest round", async () => {
    await playRound4();
    const page = await results();
    expect(page).toContain('<span class="eyebrow">Round 5</span>');
    expect(page).toContain("No squad this round, so 0 points.");
  });

  it("says so before any round has been played", async () => {
    await db.query(`delete from rounds`);
    expect(await results()).toContain("No rounds have been played yet");
  });
});
