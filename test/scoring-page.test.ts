import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ScoringPage from "@/app/scoring/page";
import { SCORING_CATEGORIES, SCORING_WEIGHTS } from "@/scoring/score";

describe("/scoring page", () => {
  // No cookies, session or request: the page must render for a signed-out visitor.
  const html = renderToStaticMarkup(ScoringPage());

  it("renders for a signed-out visitor", () => {
    expect(html).toContain("How scoring works");
  });

  it("lists the weight for all six stat categories", () => {
    const rows = [...html.matchAll(/<tr data-category="(\w+)"><th scope="row">([^<]+)<\/th><td[^>]*>([^<]+)<\/td>/g)];
    expect(rows.map((r) => r[1])).toEqual(SCORING_CATEGORIES);
    for (const [, category, , shown] of rows) {
      const weight = SCORING_WEIGHTS[category as keyof typeof SCORING_WEIGHTS];
      expect(shown.replace("−", "-").replace("+", "")).toBe(String(weight));
    }
    expect(rows.map((r) => r[2])).toEqual(["Point", "Rebound", "Assist", "Steal", "Block", "Turnover"]);
  });

  it("shows the worked example computed by the real formula", () => {
    expect(html).toContain("<strong>34.8</strong>");
  });
});
