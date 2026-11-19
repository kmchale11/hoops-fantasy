// Writes www/, the only files bundled in the app: an empty start page (the app loads the
// website instead) and the offline page, pointing at the website this sync uses.
import { mkdirSync, writeFileSync } from "node:fs";
import { appOfflineHtml } from "../../src/lib/pwa/offline-page.ts";
import { appUrl } from "../app-url.ts";

const dir = new URL("../www/", import.meta.url);
mkdirSync(dir, { recursive: true });
writeFileSync(new URL("index.html", dir), '<!doctype html>\n<html lang="en-IE"><title>Hoops Fantasy</title></html>\n');
writeFileSync(new URL("offline.html", dir), appOfflineHtml(appUrl()));
