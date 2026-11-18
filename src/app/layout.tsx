import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hoops Fantasy",
  description: "Free-to-play fantasy basketball for Irish domestic leagues",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-IE">
      <body>{children}</body>
    </html>
  );
}
