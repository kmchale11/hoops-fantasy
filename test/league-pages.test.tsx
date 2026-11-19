import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createLeague, joinLeague, myLeagues } from "@/leagues/leagues";
import type { Db } from "@/lib/db";
import { refreshUserScores } from "@/squads/squads";
import { auth, form, redirectOf, resetAuth } from "./helpers/auth";
import { count, createTestDb } from "./helpers/db";
import { addManager, seedLeague } from "./helpers/league";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", async () => (await import("./helpers/auth")).supabaseServerMock);
vi.mock("@/lib/server-db", async () => (await import("./helpers/auth")).serverDbMock);

const { default: LeaguesPage } = await import("@/app/leagues/page");
const { default: LeaguePage } = await import("@/app/leagues/[id]/page");
const { default: JoinPage } = await import("@/app/leagues/join/page");
const { default: LeaderboardPage } = await import("@/app/leaderboard/page");
const actions = await import("@/app/leagues/actions");

const html = (text: string) => text.replace(/&/g, "&amp;").replace(/'/g, "&#x27;");
const props = <P extends object, S extends object>(params: P, searchParams: S) => ({
  params: Promise.resolve(params),
  searchParams: Promise.resolve(searchParams),
});
const emptyForm = { error: null, value: "" };

let db: Db;
let aoife: string;
let brian: string;
const signIn = (id: string) => (auth.user = { id, email: "someone@example.ie" });

beforeEach(async () => {
  ({ db } = await createTestDb());
  resetAuth(db);
  await seedLeague(db);
  aoife = await addManager(db, "Aoife");
  brian = await addManager(db, "Brian");
  signIn(aoife);
});

async function league(adminId = aoife) {
  const result = await createLeague(db, adminId, "Moycullen Masters");
  if (!result.ok) throw new Error(result.error);
  return result;
}

describe("leaderboard screen", () => {
  it("highlights the signed-in user's row and links to their page", async () => {
    // Everyone has a squad and no points yet, so all four share first place.
    const users = [aoife, brian];
    for (const name of ["Ciara", "Dara"]) users.push(await addManager(db, name));
    await db.query(
      `insert into rounds (number, name, starts_at, ends_at) values (1, 'Round 1', now() - interval '9 days', now() - interval '6 days')`,
    );
    for (const user of users) {
      await db.query(
        `with s as (insert into squads (user_id, round_id, captain_player_id, saved_at) values ($1, 1, 1, now()) returning id)
         insert into squad_players (squad_id, player_id, price_at_pick) select id, 1, 4 from s`,
        [user],
      );
    }
    await refreshUserScores(db);

    const page = renderToStaticMarkup(await LeaderboardPage(props({}, {}) as never));
    expect(page).toContain("You&#x27;re ranked <strong>1</strong> of 4");
    expect(page).toMatch(/<tr class="[^"]*me[^"]*" aria-current="true"><td[^>]*>1<\/td><th scope="row">Aoife&#x27;s Team/);
    expect(page.match(/aria-current/g)).toHaveLength(1);
  });

  it("asks users without a squad to pick one", async () => {
    const page = renderToStaticMarkup(await LeaderboardPage(props({}, {}) as never));
    expect(page).toContain("to appear on the leaderboard");
    expect(page).toContain("Nobody has picked a squad yet");
  });
});

describe("creating a league", () => {
  it("creates the league and opens it with the code to share", async () => {
    const where = await redirectOf(() => actions.createLeagueAction(emptyForm, form({ name: "Moycullen Masters" })));
    const [created] = await myLeagues(db, aoife);
    expect(where).toBe(`/leagues/${created.id}?created=1`);

    const page = renderToStaticMarkup(await LeaguePage(props({ id: String(created.id) }, { created: "1" }) as never));
    const [{ invite_code: code }] = await db.query<{ invite_code: string }>(`select invite_code from mini_leagues`);
    expect(page).toContain("League created. Share the invite code");
    expect(page).toContain(`>${code}</p>`);
    expect(page).toContain(`/join/${code}`);
    expect(page).toContain("Get a new code");
  });

  it("explains a bad name without saving", async () => {
    expect(await actions.createLeagueAction(emptyForm, form({ name: "AB" }))).toEqual({
      error: "League names must be 3–40 characters",
      value: "AB",
    });
    expect(await count(db, "mini_leagues")).toBe(0);
  });

  it("lists the user's leagues", async () => {
    await league();
    const page = renderToStaticMarkup(await LeaguesPage(props({}, {}) as never));
    expect(page).toContain("Moycullen Masters");
    expect(page).toContain("1 member · you run it");
  });
});

describe("joining by code", () => {
  it("joins and opens the league", async () => {
    const { leagueId, inviteCode } = await league();
    signIn(brian);
    expect(await redirectOf(() => actions.joinLeagueAction(emptyForm, form({ code: inviteCode })))).toBe(
      `/leagues/${leagueId}`,
    );
    const page = renderToStaticMarkup(await LeaguePage(props({ id: String(leagueId) }, {}) as never));
    expect(page).toContain(html("Brian's Team"));
    expect(page).toContain(html("Aoife's Team"));
    expect(page).not.toContain("Get a new code");
  });

  it("says when a code isn't recognised", async () => {
    signIn(brian);
    expect(await actions.joinLeagueAction(emptyForm, form({ code: "ZZZZZZ" }))).toEqual({
      error: "That invite code wasn't recognised. Check it with whoever sent it.",
      value: "ZZZZZZ",
    });
  });

  it("fills in the code from an invite link, keeping it through sign-in", async () => {
    const page = renderToStaticMarkup(await JoinPage(props({}, { code: "ABC234" }) as never));
    expect(page).toContain('value="ABC234"');
    auth.user = null;
    expect(await redirectOf(() => JoinPage(props({}, { code: "ABC234" }) as never))).toBe(
      `/sign-in?next=${encodeURIComponent("/leagues/join?code=ABC234")}`,
    );
  });
});

describe("league page", () => {
  it("shows non-members a prompt to join instead of the table", async () => {
    const { leagueId } = await league();
    signIn(brian);
    const page = renderToStaticMarkup(await LeaguePage(props({ id: String(leagueId) }, {}) as never));
    expect(page).toContain("Join this league");
    expect(page).not.toContain("Moycullen Masters");
    expect(page).not.toContain(html("Aoife's Team"));
  });

  it("ignores error messages it didn't write", async () => {
    const { leagueId } = await league();
    const page = renderToStaticMarkup(
      await LeaguePage(props({ id: String(leagueId) }, { error: "Your account is locked, call 555" }) as never),
    );
    expect(page).not.toContain("call 555");
  });
});

describe("leaving and managing a league", () => {
  it("lets a member leave", async () => {
    const { leagueId, inviteCode } = await league();
    await joinLeague(db, brian, inviteCode);
    signIn(brian);
    expect(await redirectOf(() => actions.leaveLeagueAction(form({ league: String(leagueId) })))).toBe("/leagues?left=1");
    expect(await myLeagues(db, brian)).toEqual([]);
  });

  it("lets the admin remove a member and get a new code", async () => {
    const { leagueId, inviteCode } = await league();
    await joinLeague(db, brian, inviteCode);
    const page = renderToStaticMarkup(await LeaguePage(props({ id: String(leagueId) }, {}) as never));
    expect(page).toContain(`aria-label="Remove ${html("Brian's Team")}"`);

    expect(
      await redirectOf(() => actions.removeMemberAction(form({ league: String(leagueId), member: brian }))),
    ).toBe(`/leagues/${leagueId}`);
    expect(await myLeagues(db, brian)).toEqual([]);

    expect(await redirectOf(() => actions.regenerateCodeAction(form({ league: String(leagueId) })))).toBe(
      `/leagues/${leagueId}`,
    );
    const [{ invite_code: code }] = await db.query<{ invite_code: string }>(`select invite_code from mini_leagues`);
    expect(code).not.toBe(inviteCode);
  });

  it("shows why a non-admin can't remove anyone", async () => {
    const { leagueId, inviteCode } = await league();
    await joinLeague(db, brian, inviteCode);
    signIn(brian);
    const where = await redirectOf(() => actions.removeMemberAction(form({ league: String(leagueId), member: aoife })));
    expect(where).toBe(`/leagues/${leagueId}?error=${encodeURIComponent("Only the league admin can do that")}`);
    const page = renderToStaticMarkup(
      await LeaguePage(props({ id: String(leagueId) }, { error: "Only the league admin can do that" }) as never),
    );
    expect(page).toContain("Only the league admin can do that");
  });
});
