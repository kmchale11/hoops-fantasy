import type { Metadata, Viewport } from "next";
import "./globals.css";
import NativeLinks from "./pwa/native-links";
import OfflineBanner from "./pwa/offline-banner";
import ServiceWorker from "./pwa/service-worker";

export const metadata: Metadata = {
  title: "Hoops Fantasy",
  description: "Free-to-play fantasy basketball for Irish domestic leagues",
  // iOS reads these rather than the manifest when a page is added to the home screen.
  appleWebApp: { capable: true, title: "Hoops Fantasy", statusBarStyle: "default" },
  icons: { apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#0b6e4f",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-IE">
      <body>
        <OfflineBanner />
        {children}
        <ServiceWorker />
        <NativeLinks />
      </body>
    </html>
  );
}
