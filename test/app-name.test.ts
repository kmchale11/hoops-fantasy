import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { APP_NAME, APP_SHORT_NAME, INDEPENDENCE_NOTICE } from "@/lib/app-identity";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", async () => (await import("./helpers/auth")).supabaseServerMock);
vi.mock("@/lib/server-db", async () => (await import("./helpers/auth")).serverDbMock);
vi.mock("next/font/google", () => {
  const font = () => ({ className: "font", variable: "font" });
  return { Barlow_Condensed: font, Inter: font };
});

const { metadata } = await import("@/app/layout");
const { default: Home } = await import("@/app/page");

/** Every text file under a folder. */
function textFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return textFiles(path);
    return /\.(tsx?|js|mjs|css|json|html|md|xml|txt)$/.test(name) ? [path] : [];
  });
}

describe("app name", () => {
  it("comes from APP_NAME, with no old name left in src/ or public/", () => {
    const stale = [...textFiles("src"), ...textFiles("public")].filter((f) =>
      readFileSync(f, "utf8").includes("Hoops Fantasy"),
    );
    expect(stale).toEqual([]);
  });

  it("matches APP_NAME in the files that can't import it", () => {
    expect(readFileSync("public/sw.js", "utf8")).toContain(`// ${APP_NAME} service worker`);
    const strings = readFileSync("mobile/android/app/src/main/res/values/strings.xml", "utf8");
    expect(strings).toContain(`<string name="app_name">${APP_NAME}</string>`);
    expect(strings).toContain(`<string name="title_activity_main">${APP_SHORT_NAME}</string>`);
  });

  it("ends every page title with the name", () => {
    expect(metadata.title).toEqual({ default: APP_NAME, template: `%s · ${APP_NAME}` });
    expect(metadata.appleWebApp).toMatchObject({ title: APP_SHORT_NAME });
  });

  it("shows the independence notice on the home page, for visitors too", () => {
    const html = renderToStaticMarkup(Home());
    expect(INDEPENDENCE_NOTICE).toBe("Not affiliated with or endorsed by Basketball Ireland.");
    expect(html).toContain(`<h1>${APP_NAME}</h1>`);
    expect(html).toContain(INDEPENDENCE_NOTICE);
    expect(html).not.toMatch(/official/i);
  });

  it("has a short name that fits under an iPhone icon", () => {
    expect(APP_SHORT_NAME.length).toBeLessThanOrEqual(12);
  });
});
