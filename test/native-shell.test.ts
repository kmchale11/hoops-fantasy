import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { APP_LINK_PATHS, PRODUCTION_URL } from "@/lib/app-identity";
import { inAppPath, nativeShell } from "@/lib/native/shell";

afterEach(() => {
  delete (globalThis as { Capacitor?: unknown }).Capacitor;
});

describe("links opened in the app", () => {
  it("opens league invites and sign-in links on our website", () => {
    expect(inAppPath("https://hoopsfantasy.ie/join/ABC234")).toBe("/join/ABC234");
    expect(inAppPath("https://hoopsfantasy.ie/auth/callback?token_hash=t&type=magiclink&next=%2Fsquad")).toBe(
      "/auth/callback?token_hash=t&type=magiclink&next=%2Fsquad",
    );
  });

  it("ignores other pages, other websites and anything that isn't https", () => {
    expect(inAppPath("https://hoopsfantasy.ie/admin/prices")).toBeNull();
    expect(inAppPath("https://hoopsfantasy.ie/joined")).toBeNull();
    expect(inAppPath("https://evil.example/join/ABC234")).toBeNull();
    expect(inAppPath("https://hoopsfantasy.ie.evil.example/join/ABC234")).toBeNull();
    expect(inAppPath("http://hoopsfantasy.ie/join/ABC234")).toBeNull();
    expect(inAppPath("javascript:alert(1)")).toBeNull();
    expect(inAppPath("not a link")).toBeNull();
  });

  it("is only active inside the app", () => {
    expect(nativeShell()).toBeNull();
    (globalThis as { Capacitor?: unknown }).Capacitor = { isNativePlatform: () => false, Plugins: {} };
    expect(nativeShell()).toBeNull();
    (globalThis as { Capacitor?: unknown }).Capacitor = { isNativePlatform: () => true, Plugins: {} };
    expect(nativeShell()).not.toBeNull();
  });

  it("claims the same links in the Android app as the website lists", () => {
    const manifest = readFileSync("mobile/android/app/src/main/AndroidManifest.xml", "utf8");
    expect(manifest).toContain(`android:host="${new URL(PRODUCTION_URL).host}"`);
    for (const path of APP_LINK_PATHS) {
      expect(manifest).toContain(`android:pathPrefix="${path.replace(/\*$/, "")}"`);
    }
  });
});
