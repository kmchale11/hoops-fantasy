import { describe, expect, it } from "vitest";
import { loadConfig } from "@/lib/config";

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
