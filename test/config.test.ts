import { describe, expect, it } from "vitest";
import { loadConfig, missingProductionSettings } from "@/lib/config";

describe("loadConfig", () => {
  it("defaults to the mock feed at its latest stage", () => {
    const config = loadConfig({});
    expect(config.feedSource).toBe("mock");
    expect(config.mockStage).toBe(3);
  });

  it("reads FEED_SOURCE case-insensitively", () => {
    expect(loadConfig({ FEED_SOURCE: " NBN23 " }).feedSource).toBe("nbn23");
  });

  it("rejects an unknown feed source", () => {
    expect(() => loadConfig({ FEED_SOURCE: "scraper" })).toThrow(/FEED_SOURCE/);
  });

  it("rejects an invalid mock stage", () => {
    expect(() => loadConfig({ MOCK_STAGE: "7" })).toThrow(/MOCK_STAGE/);
  });

  it("treats empty secrets as unset", () => {
    expect(loadConfig({ CRON_SECRET: "" }).cronSecret).toBeUndefined();
  });
});

describe("missingProductionSettings", () => {
  const webPush = { NEXT_PUBLIC_VAPID_PUBLIC_KEY: "pub", VAPID_PRIVATE_KEY: "priv", VAPID_SUBJECT: "mailto:a@b.ie" };
  const firebase = { FIREBASE_PROJECT_ID: "p", FIREBASE_CLIENT_EMAIL: "e", FIREBASE_PRIVATE_KEY: "k" };

  it("names every missing Web Push setting", () => {
    const problem = missingProductionSettings({ VAPID_SUBJECT: "mailto:a@b.ie", VAPID_PRIVATE_KEY: " " });
    expect(problem).toMatch(/NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY\./);
    expect(problem).toMatch(/\.env\.example/);
  });

  it("doesn't need Firebase until native push is turned on", () => {
    expect(missingProductionSettings(webPush)).toBeNull();
    expect(missingProductionSettings({ ...webPush, NATIVE_PUSH_ENABLED: "false" })).toBeNull();
  });

  it("needs Firebase once native push is turned on", () => {
    expect(missingProductionSettings({ ...webPush, NATIVE_PUSH_ENABLED: "true", FIREBASE_PROJECT_ID: "p" })).toMatch(
      /FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY\./,
    );
    expect(missingProductionSettings({ ...webPush, ...firebase, NATIVE_PUSH_ENABLED: " TRUE " })).toBeNull();
  });
});
