import type { MetadataRoute } from "next";

/** Makes the site installable. The installed app opens through /start (see start/route.ts). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Hoops Fantasy",
    short_name: "Hoops Fantasy",
    description: "Free-to-play fantasy basketball for Irish domestic leagues",
    start_url: "/start",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#0b6e4f",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
