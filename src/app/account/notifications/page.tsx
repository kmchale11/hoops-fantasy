import type { Metadata } from "next";
import Link from "next/link";
import { requireCompleteAccount } from "@/lib/guards";
import { getDb } from "@/lib/server-db";
import { getNotificationSettings } from "@/notifications/settings";
import NotificationSettings from "./notification-settings";

export const metadata: Metadata = { title: "Notifications · Hoops Fantasy" };

export const instant = false;

export default async function NotificationsPage() {
  const { user } = await requireCompleteAccount("/account/notifications");
  const settings = await getNotificationSettings(getDb(), user.id);

  return (
    <main>
      <p className="muted">
        <Link href="/account">Your account</Link>
      </p>
      <h1>Notifications</h1>
      <p className="muted">
        We only send what you choose here, to devices where you&apos;ve turned notifications on.
      </p>
      <NotificationSettings initial={settings} vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || null} />
    </main>
  );
}
