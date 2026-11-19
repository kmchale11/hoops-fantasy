"use client";

import { useEffect } from "react";
import { inAppPath, nativeShell } from "@/lib/native/shell";

/**
 * In the iOS and Android apps, opens the page for an invite or sign-in link tapped elsewhere on
 * the phone (Messages, WhatsApp, email). Links that started the app are held until this runs.
 */
export default function NativeLinks() {
  useEffect(() => {
    const app = nativeShell()?.Plugins.App;
    if (!app) return;
    const listener = app.addListener("appUrlOpen", ({ url }) => {
      const path = inAppPath(url);
      if (path) window.location.assign(path);
    });
    return () => void listener.then((l) => l.remove());
  }, []);
  return null;
}
