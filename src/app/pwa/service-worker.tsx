"use client";

import { useEffect } from "react";

/** Registers public/sw.js, which supplies the offline screen and push notifications. */
export default function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
      // Without a worker the site still works; it just has no offline screen or web push.
    });
  }, []);
  return null;
}
