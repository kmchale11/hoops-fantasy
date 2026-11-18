import type { PGlite } from "@electric-sql/pglite";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createProfile, getProfile, validateSignUp, type SignUpInput } from "@/accounts/profile";
import type { Db } from "@/lib/db";
import { auth, form, redirectOf, resetAuth } from "./helpers/auth";
import { asUser, count, createAuthUser, createTestDb } from "./helpers/db";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", async () => (await import("./helpers/auth")).supabaseServerMock);
vi.mock("@/lib/server-db", async () => (await import("./helpers/auth")).serverDbMock);

const { completeSignUp } = await import("@/app/welcome/actions");
const { requireCompleteAccount } = await import("@/lib/guards");

const NOW = new Date("2026-11-19T20:00:00Z");
const valid: SignUpInput = {
  managerName: "Niamh",
  teamName: "Moy Valley Ballers",
  ageConfirmed: true,
  termsAccepted: true,
};

let db: Db;
let pg: PGlite;
let niamh: string;
let ciarán: string;

beforeEach(async () => {
  ({ db, pg } = await createTestDb());
  resetAuth(db);
  niamh = await createAuthUser(db, "niamh@example.ie");
  ciarán = await createAuthUser(db, "ciaran@example.ie");
});

describe("adult confirmation", () => {
  it("won't create a profile without the 18+ confirmation", async () => {
    const result = await createProfile(db, niamh, { ...valid, ageConfirmed: false }, NOW);
    expect(result).toEqual({ ok: false, errors: { ageConfirmed: "You must be 18 or over to play" } });
    expect(await count(db, "profiles")).toBe(0);
  });

  it("won't create a profile without accepting the terms", async () => {
    const result = await createProfile(db, niamh, { ...valid, termsAccepted: false }, NOW);
    expect(result.ok).toBe(false);
    expect(await count(db, "profiles")).toBe(0);
  });

  it("records when the user confirmed their age and accepted the terms", async () => {
    const result = await createProfile(db, niamh, valid, NOW);
    expect(result).toMatchObject({ ok: true, profile: { ageConfirmedAt: NOW, termsAcceptedAt: NOW, isAdmin: false } });
  });

  it("keeps a user without consent out of squad selection", async () => {
    auth.user = { id: niamh, email: "niamh@example.ie" };
    const state = await completeSignUp(
      { errors: {}, values: { managerName: "", teamName: "" } },
      form({ managerName: "Niamh", teamName: "Moy Valley Ballers", termsAccepted: "on", next: "/squad" }),
    );
    expect(state.errors.ageConfirmed).toBe("You must be 18 or over to play");
    expect(await redirectOf(() => requireCompleteAccount("/squad"))).toBe("/welcome?next=%2Fsquad");
  });

  it("lets the user into squad selection once they've consented", async () => {
    auth.user = { id: niamh, email: "niamh@example.ie" };
    const to = await redirectOf(() =>
      completeSignUp(
        { errors: {}, values: { managerName: "", teamName: "" } },
        form({ managerName: "Niamh", teamName: "Moy Valley Ballers", ageConfirmed: "on", termsAccepted: "on", next: "/squad" }),
      ),
    );
    expect(to).toBe("/squad");
    expect(await requireCompleteAccount("/squad")).toMatchObject({ status: "ready", profile: { teamName: "Moy Valley Ballers" } });
  });

  it("sends signed-out visitors to sign in first", async () => {
    expect(await redirectOf(() => requireCompleteAccount("/squad"))).toBe("/sign-in?next=%2Fsquad");
  });
});

describe("name rules", () => {
  const errorsFor = (managerName: string, teamName = "Moy Valley Ballers") =>
    validateSignUp({ ...valid, managerName, teamName });

  it("accepts 3 to 30 characters", () => {
    expect(errorsFor("Bob")).toEqual({});
    expect(errorsFor("x".repeat(30))).toEqual({});
  });

  it("rejects 2 or 31 characters", () => {
    expect(errorsFor("Bo").managerName).toBe("Manager name must be 3–30 characters");
    expect(errorsFor("x".repeat(31)).managerName).toBe("Manager name must be 3–30 characters");
    expect(errorsFor("Niamh", "Ab").teamName).toBe("Team name must be 3–30 characters");
  });

  it("ignores surrounding spaces and counts accented letters once", () => {
    expect(errorsFor("   Bo   ").managerName).toBeDefined();
    expect(errorsFor("Seán")).toEqual({});
  });

  it("stores names tidied up", async () => {
    const result = await createProfile(db, niamh, { ...valid, teamName: "  Moy   Valley Ballers " }, NOW);
    expect(result.ok && result.profile.teamName).toBe("Moy Valley Ballers");
  });

  it("is enforced by the database too", async () => {
    await expect(
      db.query(
        `insert into profiles (user_id, manager_name, team_name, age_confirmed_at, terms_accepted_at)
         values ($1, 'Bo', 'Moy Valley Ballers', now(), now())`,
        [niamh],
      ),
    ).rejects.toThrow(/profiles_manager_name_length/);
  });
});

describe("unique team names", () => {
  it("tells the second user the name is taken", async () => {
    await createProfile(db, niamh, valid, NOW);
    const result = await createProfile(db, ciarán, { ...valid, managerName: "Ciarán" }, NOW);
    expect(result).toEqual({ ok: false, errors: { teamName: "That team name is taken" } });
    expect(await count(db, "profiles")).toBe(1);
  });

  it("treats names differing only in case as the same", async () => {
    await createProfile(db, niamh, valid, NOW);
    const result = await createProfile(db, ciarán, { ...valid, teamName: "moy valley BALLERS" }, NOW);
    expect(result.ok).toBe(false);
  });
});

describe("row-level security", () => {
  beforeEach(async () => {
    await createProfile(db, niamh, valid, NOW);
    await createProfile(db, ciarán, { ...valid, managerName: "Ciarán", teamName: "Tuam Titans" }, NOW);
  });

  it("lets users read only their own profile", async () => {
    const rows = await asUser(pg, niamh, (q) => q<{ team_name: string }>(`select team_name from profiles`));
    expect(rows.map((r) => r.team_name)).toEqual(["Moy Valley Ballers"]);
  });

  it("lets users rename their own team but not anyone else's", async () => {
    const own = await asUser(pg, niamh, (q) => q(`update profiles set team_name = 'Moy Valley Kings' returning user_id`));
    expect(own).toHaveLength(1);
    const other = await asUser(pg, niamh, (q) =>
      q(`update profiles set team_name = 'Hijacked' where user_id = $1 returning user_id`, [ciarán]),
    );
    expect(other).toHaveLength(0);
    expect((await getProfile(db, ciarán))?.teamName).toBe("Tuam Titans");
  });

  it("doesn't let users make themselves admin or change their consent records", async () => {
    await expect(asUser(pg, niamh, (q) => q(`update profiles set is_admin = true`))).rejects.toThrow(/permission denied/);
    await expect(asUser(pg, niamh, (q) => q(`update profiles set age_confirmed_at = now()`))).rejects.toThrow(
      /permission denied/,
    );
  });

  it("doesn't let users create or delete profiles through the API", async () => {
    const third = await createAuthUser(db, "third@example.ie");
    await expect(
      asUser(pg, third, (q) =>
        q(
          `insert into profiles (user_id, manager_name, team_name, age_confirmed_at, terms_accepted_at)
           values ($1, 'Sneaky', 'No Consent FC', now(), now())`,
          [third],
        ),
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(asUser(pg, niamh, (q) => q(`delete from profiles`))).rejects.toThrow(/permission denied/);
  });

  it("shows signed-out visitors nothing", async () => {
    await expect(asUser(pg, null, (q) => q(`select * from profiles`))).rejects.toThrow(/permission denied/);
  });
});
