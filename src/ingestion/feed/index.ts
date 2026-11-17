import type { AppConfig } from "@/lib/config";
import { MockFeedAdapter } from "./mock/adapter";
import type { FeedAdapter } from "./types";

export function createFeedAdapter(config: AppConfig): FeedAdapter {
  switch (config.feedSource) {
    case "mock":
      return new MockFeedAdapter(config.mockStage);
    case "nbn23":
      // Built once Basketball Ireland / NBN23 agree a data feed; the mock defines the contract.
      throw new Error("The NBN23 feed adapter isn't available yet. Use FEED_SOURCE=mock.");
  }
}

export type * from "./types";
