import { PRODUCTION_URL } from "../src/lib/app-identity.ts";

/**
 * The website the app loads. APP_URL points it somewhere else for testing, e.g. a local copy
 * of the site (`npm run android:local` forwards the emulator's localhost to this Mac). Read at each sync.
 */
export const appUrl = (): string => process.env.APP_URL || PRODUCTION_URL;
