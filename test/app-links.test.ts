import { afterEach, describe, expect, it, vi } from "vitest";
import { redirectOf } from "./helpers/auth";

const { GET: aasa } = await import("@/app/.well-known/apple-app-site-association/route");
const { GET: assetlinks } = await import("@/app/.well-known/assetlinks.json/route");
const { default: JoinLink } = await import("@/app/join/[code]/page");

const FINGERPRINT = Array.from({ length: 32 }, (_, i) => (i * 7).toString(16).padStart(2, "0").toUpperCase()).join(":");

afterEach(() => vi.unstubAllEnvs());

describe("app links", () => {
  it("serves the iOS association file for invite and sign-in links", async () => {
    vi.stubEnv("APPLE_TEAM_ID", "A1B2C3D4E5");
    const res = await aasa();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/json");
    expect(await res.json()).toEqual({
      applinks: {
        details: [
          { appIDs: ["A1B2C3D4E5.ie.hoopsfantasy.app"], components: [{ "/": "/join/*" }, { "/": "/auth/callback*" }] },
        ],
      },
    });
  });

  it("serves the Android asset links file", async () => {
    vi.stubEnv("ANDROID_CERT_SHA256", ` ${FINGERPRINT.toLowerCase()} , not-a-fingerprint`);
    const res = await assetlinks();
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/json");
    expect(await res.json()).toEqual([
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: { namespace: "android_app", package_name: "ie.hoopsfantasy.app", sha256_cert_fingerprints: [FINGERPRINT] },
      },
    ]);
  });

  it("serves nothing until the app's signing details are set", async () => {
    vi.stubEnv("APPLE_TEAM_ID", "");
    vi.stubEnv("ANDROID_CERT_SHA256", "");
    expect((await aasa()).status).toBe(404);
    expect((await assetlinks()).status).toBe(404);
  });

  it("sends short invite links to the join screen", async () => {
    expect(await redirectOf(() => JoinLink({ params: Promise.resolve({ code: "ABC234" }) } as never))).toBe(
      "/leagues/join?code=ABC234",
    );
  });
});
