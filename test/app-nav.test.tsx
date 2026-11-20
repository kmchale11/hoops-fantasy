import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { auth, resetAuth } from "./helpers/auth";
import { createTestDb } from "./helpers/db";
import { addManager } from "./helpers/league";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", async () => (await import("./helpers/auth")).supabaseServerMock);
vi.mock("@/lib/server-db", async () => (await import("./helpers/auth")).serverDbMock);
const path = vi.hoisted(() => ({ current: "/" }));
vi.mock("next/navigation", async (original) => ({
  ...(await original<typeof import("next/navigation")>()),
  usePathname: () => path.current,
}));

const { default: AppNav } = await import("@/app/nav/app-nav");

/** The menu's links as [label, href], and which one is marked as the current page. */
async function menu(at: string) {
  path.current = at;
  const html = renderToStaticMarkup(await AppNav());
  const links = [...html.matchAll(/<a ([^>]*)><svg.*?<\/svg><span>([^<]+)<\/span>/g)].map(([, attrs, label]) => ({
    label,
    href: /href="([^"]+)"/.exec(attrs)![1],
    current: attrs.includes('aria-current="page"'),
  }));
  return {
    html,
    links: links.map((l) => [l.label, l.href]),
    current: links.filter((l) => l.current).map((l) => l.label),
  };
}

let niamh: string;
beforeEach(async () => {
  const { db } = await createTestDb();
  resetAuth(db);
  niamh = await addManager(db, "Niamh");
  auth.user = { id: niamh, email: "niamh@example.ie" };
});

describe("menu", () => {
  it("shows a signed-in player the five sections", async () => {
    expect((await menu("/squad")).links).toEqual([
      ["Squad", "/squad"],
      ["Results", "/results"],
      ["Leagues", "/leagues"],
      ["Leaderboard", "/leaderboard"],
      ["More", "/more"],
    ]);
  });

  it("adds Admin to the top bar for admins, hidden on phones", async () => {
    const { db } = await createTestDb();
    resetAuth(db);
    const aoife = await addManager(db, "Aoife");
    await db.query(`update profiles set is_admin = true where user_id = $1`, [aoife]);
    auth.user = { id: aoife, email: "aoife@example.ie" };
    const { links, html } = await menu("/admin/prices");
    expect(links.map(([label]) => label)).toEqual(["Squad", "Results", "Leagues", "Leaderboard", "More", "Admin"]);
    expect(html).toMatch(/<li class="[^"]*wideOnly[^"]*"><a [^>]*aria-current="page" href="\/admin"/);
  });

  it("shows visitors Home, How to play and Sign in only", async () => {
    auth.user = null;
    expect((await menu("/")).links).toEqual([
      ["Home", "/"],
      ["How to play", "/how-to-play"],
      ["Sign in", "/sign-in"],
    ]);
  });

  it("is a labelled navigation landmark of real links", async () => {
    const { html } = await menu("/results");
    expect(html).toMatch(/^<nav aria-label="Main"/);
    expect(html).not.toMatch(/role=|onClick|tabindex/i);
  });

  it("marks the current section on each page, including pages inside it", async () => {
    const cases: [string, string][] = [
      ["/squad", "Squad"],
      ["/results", "Results"],
      ["/leagues", "Leagues"],
      ["/leagues/7", "Leagues"],
      ["/join/ABC234", "Leagues"],
      ["/leaderboard", "Leaderboard"],
      ["/more", "More"],
      ["/how-to-play", "More"],
      ["/account/notifications", "More"],
    ];
    for (const [at, section] of cases) expect((await menu(at)).current, at).toEqual([section]);
    expect((await menu("/somewhere-else")).current).toEqual([]);
  });

  it("marks Home only on the home page for visitors", async () => {
    auth.user = null;
    expect((await menu("/")).current).toEqual(["Home"]);
    expect((await menu("/how-to-play")).current).toEqual(["How to play"]);
    expect((await menu("/privacy")).current).toEqual([]);
  });
});
