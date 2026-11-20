// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { auth, redirectOf, resetAuth } from "./helpers/auth";
import { createTestDb } from "./helpers/db";
import { addManager } from "./helpers/league";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", async () => (await import("./helpers/auth")).supabaseServerMock);
vi.mock("@/lib/server-db", async () => (await import("./helpers/auth")).serverDbMock);

const { default: MorePage } = await import("@/app/more/page");
const { default: AdminPage } = await import("@/app/admin/page");
const { default: InstallRow } = await import("@/app/pwa/install-row");

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let player: string;
let admin: string;
beforeEach(async () => {
  const { db } = await createTestDb();
  resetAuth(db);
  player = await addManager(db, "Ciaran");
  admin = await addManager(db, "Aoife");
  await db.query(`update profiles set is_admin = true where user_id = $1`, [admin]);
});

describe("More page", () => {
  it("lists help, settings and sign out, without Admin for players", async () => {
    auth.user = { id: player, email: "ciaran@example.ie" };
    const html = renderToStaticMarkup(await MorePage());
    for (const label of ["How to play", "How scoring works", "Notifications", "Your account", "Sign out"]) {
      expect(html).toContain(label);
    }
    expect(html).toContain("Ciaran&#x27;s Team");
    expect(html).not.toContain('href="/admin"');
    expect(await redirectOf(() => AdminPage())).toBe("404");
  });

  it("links admins to prices and positions, and box-score import", async () => {
    auth.user = { id: admin, email: "aoife@example.ie" };
    expect(renderToStaticMarkup(await MorePage())).toContain('href="/admin"');
    const adminPage = renderToStaticMarkup(await AdminPage());
    expect(adminPage).toContain('href="/admin/prices"');
    expect(adminPage).toContain('href="/admin/import"');
  });

  it("sends signed-out visitors to sign in", async () => {
    auth.user = null;
    expect(await redirectOf(() => MorePage())).toBe("/sign-in?next=%2Fmore");
  });
});

describe("Add to home screen", () => {
  function render(standalone: boolean) {
    window.matchMedia = vi.fn((query: string) => ({ matches: standalone && query.includes("standalone") })) as never;
    const container = document.createElement("div");
    act(() => createRoot(container).render(<InstallRow className="row" hintClassName="hint" />));
    return container;
  }

  it("is offered in the browser, and explains how when there's no install prompt", () => {
    const row = render(false);
    expect(row.textContent).toContain("Add to home screen");
    act(() => row.querySelector("button")!.click());
    expect(row.textContent).toContain("Open your browser's menu");
  });

  it("isn't listed inside the installed app", () => {
    expect(render(true).textContent).toBe("");
  });

  it("isn't listed inside the iOS and Android apps", () => {
    (globalThis as { Capacitor?: unknown }).Capacitor = { isNativePlatform: () => true, Plugins: {} };
    try {
      expect(render(false).textContent).toBe("");
    } finally {
      delete (globalThis as { Capacitor?: unknown }).Capacitor;
    }
  });
});
