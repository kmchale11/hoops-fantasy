// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { auth, resetAuth } from "./helpers/auth";
import { createTestDb } from "./helpers/db";
import { addManager } from "./helpers/league";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", async () => (await import("./helpers/auth")).supabaseServerMock);
vi.mock("@/lib/server-db", async () => (await import("./helpers/auth")).serverDbMock);
const budget = vi.hoisted(() => ({ value: 60 }));
vi.mock("@/squads/rules", async (original) => {
  const rules = await original<typeof import("@/squads/rules")>();
  return {
    ...rules,
    get BUDGET() {
      return budget.value;
    },
  };
});

const { default: HowToPlayPage } = await import("@/app/how-to-play/page");
const { default: NextStep } = await import("@/app/how-to-play/next-step");
const { default: SeenGuide } = await import("@/app/how-to-play/seen-guide");
const { default: GuidePrompt } = await import("@/app/squad/guide-prompt");

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const clearCookies = () => (document.cookie = "seen-how-to-play=; Max-Age=0; Path=/");

beforeEach(async () => {
  const { db } = await createTestDb();
  resetAuth(db);
  auth.user = null;
  budget.value = 60;
  clearCookies();
});

describe("How to play", () => {
  it("covers squads, the captain, deadlines, scoring, leagues and reminders, readable signed out", () => {
    const html = renderToStaticMarkup(<HowToPlayPage />);
    for (const heading of [
      "Build your squad",
      "Pick a captain",
      "Beat the deadline",
      "Score points",
      "Play with friends",
      "Never miss a deadline",
    ]) {
      expect(html).toContain(heading);
    }
    expect(html).toContain("2 guards, 2 forwards, 1 centre and 1 flex player");
    expect(html).toContain("No more than 2 players from the same club");
    expect(html).toContain("double points");
    expect(html).toContain("+1.2</span><span");
    expect(html).toContain("Postponed game? That player scores 0");
    expect(html).toContain("You must be 18 or over");
  });

  it("states the budget the game enforces", () => {
    expect(renderToStaticMarkup(<HowToPlayPage />)).toContain("60 credits to spend");
    budget.value = 75;
    expect(renderToStaticMarkup(<HowToPlayPage />)).toContain("75 credits to spend");
  });

  it("shows the independence notice", () => {
    expect(renderToStaticMarkup(<HowToPlayPage />)).toContain(
      "Not affiliated with or endorsed by Basketball Ireland.",
    );
  });

  it("ends with sign in for visitors, and the squad for signed-in users", async () => {
    expect(renderToStaticMarkup(await NextStep())).toContain('href="/sign-in?next=%2Fsquad">Sign in to play');
    const { db } = await createTestDb();
    resetAuth(db);
    auth.user = { id: await addManager(db, "Niamh"), email: "niamh@example.ie" };
    expect(renderToStaticMarkup(await NextStep())).toContain('href="/squad">Pick my squad');
  });
});

describe("first-visit prompt", () => {
  const render = (element: React.ReactElement) => {
    const container = document.createElement("div");
    act(() => createRoot(container).render(element));
    return container;
  };

  it("goes away for good on this device once dismissed", () => {
    const prompt = render(<GuidePrompt />);
    expect(prompt.textContent).toContain("New here?");
    act(() => [...prompt.querySelectorAll("button")].find((b) => b.textContent === "Dismiss")!.click());
    expect(prompt.textContent).toBe("");
    expect(document.cookie).toContain("seen-how-to-play=1");
  });

  it("counts opening How to play as seen", () => {
    expect(document.cookie).not.toContain("seen-how-to-play");
    render(<SeenGuide />);
    expect(document.cookie).toContain("seen-how-to-play=1");
  });
});
