import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createProfile, getProfile } from "@/accounts/profile";
import type { Db } from "@/lib/db";
import { auth, form, redirectOf, resetAuth } from "./helpers/auth";
import { count, createAuthUser, createTestDb } from "./helpers/db";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", async () => (await import("./helpers/auth")).supabaseServerMock);
vi.mock("@/lib/server-db", async () => (await import("./helpers/auth")).serverDbMock);

const { default: AccountPage } = await import("@/app/account/page");
const { deleteAccount } = await import("@/app/account/actions");

let db: Db;
let niamh: string;
let ciarán: string;

beforeEach(async () => {
  ({ db } = await createTestDb());
  resetAuth(db);
  niamh = await createAuthUser(db, "niamh@example.ie");
  ciarán = await createAuthUser(db, "ciaran@example.ie");
  await createProfile(
    db,
    niamh,
    { managerName: "Niamh", teamName: "Moy Valley Ballers", ageConfirmed: true, termsAccepted: true },
    new Date("2026-11-19T20:05:00Z"),
  );
  await createProfile(
    db,
    ciarán,
    { managerName: "Ciarán", teamName: "Tuam Titans", ageConfirmed: true, termsAccepted: true },
    new Date("2026-11-19T21:00:00Z"),
  );
  // Supabase's admin API deletes the auth user; the database cascades from there.
  auth.admin.auth.admin.deleteUser.mockImplementation(async (id: string) => {
    await db.query(`delete from auth.users where id = $1`, [id]);
    return { data: {}, error: null };
  });
  auth.user = { id: niamh, email: "niamh@example.ie" };
});

describe("account page", () => {
  it("lists every personal field held about the user", async () => {
    const html = renderToStaticMarkup(await AccountPage());
    for (const text of [
      "niamh@example.ie",
      "Niamh",
      "Moy Valley Ballers",
      "Confirmed 18 or over",
      "Accepted the terms",
      "19 November 2026 at 20:05",
    ]) {
      expect(html).toContain(text);
    }
  });

  it("asks signed-out visitors to sign in", async () => {
    auth.user = null;
    expect(await redirectOf(() => AccountPage())).toBe("/sign-in?next=%2Faccount");
  });
});

describe("account deletion", () => {
  it("removes the user and their profile, and signs them out", async () => {
    const to = await redirectOf(() => deleteAccount({}, form({ confirm: "on" })));

    expect(to).toBe("/account/deleted");
    expect(auth.admin.auth.admin.deleteUser).toHaveBeenCalledWith(niamh);
    expect(await getProfile(db, niamh)).toBeNull();
    const [user] = await db.query(`select id from auth.users where id = $1`, [niamh]);
    expect(user).toBeUndefined();
    expect(auth.client.auth.signOut).toHaveBeenCalledWith({ scope: "local" });

    // Nobody else is affected.
    expect((await getProfile(db, ciarán))?.teamName).toBe("Tuam Titans");
    expect(await count(db, "profiles")).toBe(1);
  });

  it("frees the team name for someone else", async () => {
    await redirectOf(() => deleteAccount({}, form({ confirm: "on" })));
    const newcomer = await createAuthUser(db, "new@example.ie");
    const result = await createProfile(
      db,
      newcomer,
      { managerName: "Aoife", teamName: "Moy Valley Ballers", ageConfirmed: true, termsAccepted: true },
      new Date(),
    );
    expect(result.ok).toBe(true);
  });

  it("does nothing without the confirmation tick", async () => {
    const state = await deleteAccount({}, form({}));
    expect(state.error).toMatch(/confirm/);
    expect(auth.admin.auth.admin.deleteUser).not.toHaveBeenCalled();
    expect(await getProfile(db, niamh)).not.toBeNull();
  });

  it("keeps everything if Supabase can't delete the user", async () => {
    auth.admin.auth.admin.deleteUser.mockResolvedValue({ data: null, error: { message: "boom" } });
    const state = await deleteAccount({}, form({ confirm: "on" }));
    expect(state.error).toMatch(/couldn't delete/);
    expect(await getProfile(db, niamh)).not.toBeNull();
    expect(auth.client.auth.signOut).not.toHaveBeenCalled();
  });

  it("requires a signed-in user", async () => {
    auth.user = null;
    expect(await redirectOf(() => deleteAccount({}, form({ confirm: "on" })))).toBe("/sign-in?next=/account");
    expect(auth.admin.auth.admin.deleteUser).not.toHaveBeenCalled();
  });
});
