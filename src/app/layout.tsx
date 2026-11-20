import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, Inter } from "next/font/google";
import { Suspense } from "react";
import { APP_NAME, APP_SHORT_NAME, THEME_COLOR } from "@/lib/app-identity";
import "./globals.css";
import AppNav from "./nav/app-nav";
import { NavPlaceholder } from "./nav/nav-links";
import NativeLinks from "./pwa/native-links";
import OfflineBanner from "./pwa/offline-banner";
import ServiceWorker from "./pwa/service-worker";

// Self-hosted at build time, so pages make no requests to Google.
const heading = Barlow_Condensed({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-heading" });
const body = Inter({ subsets: ["latin"], variable: "--font-body" });

export const metadata: Metadata = {
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: "Free-to-play fantasy basketball for Irish domestic leagues",
  // iOS reads these rather than the manifest when a page is added to the home screen.
  appleWebApp: { capable: true, title: APP_SHORT_NAME, statusBarStyle: "black" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: THEME_COLOR,
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-IE" className={`${heading.variable} ${body.variable}`}>
      <body>
        <a href="#content" className="skip">
          Skip to content
        </a>
        <Suspense fallback={<NavPlaceholder />}>
          <AppNav />
        </Suspense>
        <OfflineBanner />
        <div id="content">{children}</div>
        <ServiceWorker />
        <NativeLinks />
      </body>
    </html>
  );
}
