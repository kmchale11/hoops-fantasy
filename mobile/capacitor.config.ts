import type { CapacitorConfig } from "@capacitor/cli";
import { APP_ID, APP_NAME } from "../src/lib/app-identity.ts";
import { appUrl } from "./app-url.ts";

const url = appUrl();

const config: CapacitorConfig = {
  appId: APP_ID,
  appName: APP_NAME,
  // Only the offline page is bundled (written by scripts/write-web-dir.ts); everything else
  // comes from the website.
  webDir: "www",
  server: {
    url,
    cleartext: url.startsWith("http://"),
    // Shown when the website can't be loaded, e.g. opened with no connection.
    errorPath: "offline.html",
  },
};

export default config;
