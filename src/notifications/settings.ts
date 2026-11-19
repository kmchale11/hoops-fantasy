import type { Db } from "@/lib/db";
import { withUserRole } from "@/lib/user-role";

export interface NotificationSettings {
  /** The master switch: true once the user has turned notifications on. */
  enabled: boolean;
  deadlineReminders: boolean;
  roundResults: boolean;
}

/** Off until the user turns them on, then both kinds on unless they change them. */
export const DEFAULT_SETTINGS: NotificationSettings = { enabled: false, deadlineReminders: true, roundResults: true };

export async function getNotificationSettings(db: Db, userId: string): Promise<NotificationSettings> {
  const [row] = await withUserRole(db, userId, (tx) =>
    tx.query<NotificationSettings>(
      `select enabled_at is not null as enabled, deadline_reminders as "deadlineReminders",
              round_results as "roundResults"
         from notification_preferences where user_id = auth.uid()`,
    ),
  );
  return row ?? DEFAULT_SETTINGS;
}

/** Saves the user's switches. Turning the master switch on again keeps when it was first turned on. */
export async function saveNotificationSettings(
  db: Db,
  userId: string,
  settings: NotificationSettings,
  now: Date,
): Promise<void> {
  await withUserRole(db, userId, (tx) =>
    tx.query(
      `insert into notification_preferences (user_id, enabled_at, deadline_reminders, round_results, updated_at)
       values (auth.uid(), case when $1 then $4::timestamptz end, $2, $3, $4)
       on conflict (user_id) do update set
         enabled_at = case when $1 then coalesce(notification_preferences.enabled_at, $4::timestamptz) end,
         deadline_reminders = excluded.deadline_reminders,
         round_results = excluded.round_results,
         updated_at = excluded.updated_at`,
      [settings.enabled, settings.deadlineReminders, settings.roundResults, now],
    ),
  );
}

export interface DeviceSubscription {
  kind: "web" | "fcm";
  endpoint: string;
  webKeys: { p256dh: string; auth: string } | null;
  platform: "web" | "ios" | "android";
}

/** Checks a subscription sent from a browser or the app before it's stored. */
export function parseSubscription(input: unknown): DeviceSubscription | null {
  if (!input || typeof input !== "object") return null;
  const s = input as Record<string, unknown>;
  const endpoint = typeof s.endpoint === "string" ? s.endpoint : "";
  if (s.kind === "web") {
    const keys = s.keys as Record<string, unknown> | undefined;
    if (!/^https:\/\//.test(endpoint) || endpoint.length > 2048) return null;
    if (typeof keys?.p256dh !== "string" || typeof keys?.auth !== "string") return null;
    return { kind: "web", endpoint, webKeys: { p256dh: keys.p256dh, auth: keys.auth }, platform: "web" };
  }
  if (s.kind === "fcm") {
    if (!/^[\w:-]{20,4096}$/.test(endpoint)) return null;
    if (s.platform !== "ios" && s.platform !== "android") return null;
    return { kind: "fcm", endpoint, webKeys: null, platform: s.platform };
  }
  return null;
}

/** Stores this device for the signed-in user (moving it from anyone who used it before). */
export async function registerDevice(db: Db, userId: string, device: DeviceSubscription): Promise<void> {
  await withUserRole(db, userId, (tx) =>
    tx.query(`select register_push_subscription($1, $2, $3, $4)`, [
      device.kind,
      device.endpoint,
      device.webKeys ? JSON.stringify(device.webKeys) : null,
      device.platform,
    ]),
  );
}

/** Forgets one of the user's devices, e.g. when they turn notifications off in that browser. */
export async function removeDevice(db: Db, userId: string, endpoint: string): Promise<void> {
  await withUserRole(db, userId, (tx) => tx.query(`delete from push_subscriptions where endpoint = $1`, [endpoint]));
}
