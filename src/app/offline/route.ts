import { OFFLINE_HTML } from "@/lib/pwa/offline-page";

/** The offline screen the service worker caches and shows when a page can't load. */
export function GET() {
  return new Response(OFFLINE_HTML, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
