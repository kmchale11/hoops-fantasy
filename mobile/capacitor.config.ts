import type { CapacitorConfig } from "@capacitor/cli";
import { APP_ID, APP_NAME, PRODUCTION_URL } from "../src/lib/app-identity.ts";

// The app loads the live website. APP_URL points it somewhere else for testing, e.g. a local
// copy of the site (from the Android emulator, this Mac is 10.0.2.2). It's read at `cap sync`.
const url = process.env.APP_URL || PRODUCTION_URL;

const config: CapacitorConfig = {
  appId: APP_ID,
  appName: APP_NAME,
  // Only the offline page is bundled; everything else comes from the website.
  webDir: "www",
  server: {
    url,
    cleartext: url.startsWith("http://"),
  },
};

export default config;
