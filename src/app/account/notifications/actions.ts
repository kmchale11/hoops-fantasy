"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/server-db";
import { getAccount } from "@/lib/session";
import {
  getNotificationSettings,
  parseSubscription,
  registerDevice,
  removeDevice,
  saveNotificationSettings,
  type NotificationSettings,
} from "@/notifications/settings";

export type NotificationActionResult = { ok: true; settings: NotificationSettings } | { ok: false; error: string };

async function userId(): Promise<string | null> {
  const account = await getAccount();
  return account.status === "ready" ? account.user.id : null;
}

const SIGN_IN = "Sign in and finish signing up first";

/**
 * Called once the browser or phone has allowed notifications: stores this device and turns
 * the master switch on, keeping the user's choice of kinds (both on the first time).
 */
export async function enableNotifications(subscription: unknown): Promise<NotificationActionResult> {
  const id = await userId();
  if (!id) return { ok: false, error: SIGN_IN };
  const device = parseSubscription(subscription);
  if (!device) return { ok: false, error: "This device couldn't be set up for notifications. Please try again." };

  const db = getDb();
  await registerDevice(db, id, device);
  const settings = { ...(await getNotificationSettings(db, id)), enabled: true };
  await saveNotificationSettings(db, id, settings, new Date());
  revalidatePath("/account/notifications");
  return { ok: true, settings };
}

/** Turns notifications off for the user, and forgets this device if it was subscribed. */
export async function disableNotifications(endpoint: string | null): Promise<NotificationActionResult> {
  const id = await userId();
  if (!id) return { ok: false, error: SIGN_IN };
  const db = getDb();
  if (endpoint) await removeDevice(db, id, endpoint);
  const settings = { ...(await getNotificationSettings(db, id)), enabled: false };
  await saveNotificationSettings(db, id, settings, new Date());
  revalidatePath("/account/notifications");
  return { ok: true, settings };
}

/** Switches deadline reminders and round results on or off separately. */
export async function saveNotificationKinds(kinds: {
  deadlineReminders: boolean;
  roundResults: boolean;
}): Promise<NotificationActionResult> {
  const id = await userId();
  if (!id) return { ok: false, error: SIGN_IN };
  const db = getDb();
  const settings = {
    ...(await getNotificationSettings(db, id)),
    deadlineReminders: kinds.deadlineReminders === true,
    roundResults: kinds.roundResults === true,
  };
  await saveNotificationSettings(db, id, settings, new Date());
  revalidatePath("/account/notifications");
  return { ok: true, settings };
}
