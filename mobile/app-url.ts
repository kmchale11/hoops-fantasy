import { PRODUCTION_URL } from "../src/lib/app-identity.ts";

/**
 * The website the app loads. APP_URL points it somewhere else for testing, e.g. a local copy
 * of the site (from the Android emulator, this Mac is 10.0.2.2). Read at each sync.
 */
export const appUrl = (): string => process.env.APP_URL || PRODUCTION_URL;
