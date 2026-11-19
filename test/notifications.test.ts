import type { PGlite } from "@electric-sql/pglite";
import { createVerify, generateKeyPairSync } from "node:crypto";
import { WebPushError } from "web-push";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@/lib/db";
import { fcmMessage, fcmSender } from "@/notifications/fcm-sender";
import {
  dueDeadlineReminders,
  dueRoundResults,
  inQuietHours,
  messageFor,
  runNotificationPass,
} from "@/notifications/notify";
import type { PushMessage, PushSender, PushTarget, SendOutcome } from "@/notifications/sender";
import { registerDevice, saveNotificationSettings } from "@/notifications/settings";
import { webPushPayload, webPushSender } from "@/notifications/web-push-sender";
import { refreshUserScores } from "@/squads/squads";
import { asUser, count, createTestDb } from "./helpers/db";
import { addFixture, addManager, addRound, seedLeague } from "./helpers/league";

const MIN = 60 * 1000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/** Round 7's first game: Saturday 24 October 2026, 19:30 Irish time (UTC+1 that day). */
const LOCK = new Date("2026-10-24T18:30:00Z");
const before = (ms: number) => new Date(LOCK.getTime() - ms);

let db: Db;
let pg: PGlite;
let niamh: string;
let round7: number;
let firstGame: number;

const WEB_DEVICE = {
  kind: "web" as const,
  endpoint: "https://fcm.googleapis.com/fcm/send/niamh-laptop",
  webKeys: { p256dh: "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM", auth: "tBHItJI5svbpez7KI4CCXg" },
  platform: "web" as const,
};

async function optIn(userId: string, kinds = { deadlineReminders: true, roundResults: true }, at = new Date("2026-09-01")) {
  await saveNotificationSettings(db, userId, { enabled: true, ...kinds }, at);
}

beforeEach(async () => {
  ({ db, pg } = await createTestDb());
  await seedLeague(db);
  niamh = await addManager(db, "Niamh");
  await registerDevice(db, niamh, WEB_DEVICE);
  round7 = await addRound(db, 7, new Date("2026-10-23T00:00:00Z"), new Date("2026-10-26T00:00:00Z"));
  firstGame = await addFixture(db, 1, 2, LOCK);
  await addFixture(db, 3, 4, new Date(LOCK.getTime() + 2 * HOUR));
});

/** A sender that records what it was asked to send and answers with the given outcome. */
function fakeSender(outcome: SendOutcome | (() => SendOutcome) = "sent") {
  const sent: { target: PushTarget; message: PushMessage }[] = [];
  const sender: PushSender = {
    send: async (target, message) => {
      sent.push({ target, message });
      return typeof outcome === "function" ? outcome() : outcome;
    },
  };
  return { sender, sent };
}

describe("notification tables", () => {
  it("lets users see and change only their own devices and settings", async () => {
    await optIn(niamh);
    const oisin = await addManager(db, "Oisín");
    await asUser(pg, oisin, async (q) => {
      expect(await q(`select * from push_subscriptions`)).toEqual([]);
      expect(await q(`select * from notification_preferences`)).toEqual([]);
      await q(`update notification_preferences set enabled_at = null`);
      await q(`delete from push_subscriptions`);
    });
    expect(await count(db, "push_subscriptions")).toBe(1);
    const [{ enabled }] = await db.query<{ enabled: boolean }>(
      `select enabled_at is not null as enabled from notification_preferences where user_id = $1`,
      [niamh],
    );
    expect(enabled).toBe(true);

    await asUser(pg, niamh, async (q) => {
      expect(await q(`select endpoint from push_subscriptions`)).toEqual([{ endpoint: WEB_DEVICE.endpoint }]);
    });
    // Nobody reaches the sent log, or adds devices except through register_push_subscription().
    const denied = (sql: string) => expect(asUser(pg, niamh, (q) => q(sql))).rejects.toThrow(/permission denied/);
    await denied(`select * from notifications_sent`);
    await denied(`insert into push_subscriptions (user_id, kind, endpoint, platform) values (auth.uid(), 'fcm', 'x', 'ios')`);
    await expect(
      asUser(pg, oisin, (q) => q(`insert into notification_preferences (user_id) values ($1)`, [niamh])),
    ).rejects.toThrow(/row-level security/);
  });

  it("moves a shared browser to whoever is signed in now", async () => {
    const oisin = await addManager(db, "Oisín");
    await registerDevice(db, oisin, WEB_DEVICE);
    const rows = await db.query<{ user_id: string }>(`select user_id from push_subscriptions`);
    expect(rows).toEqual([{ user_id: oisin }]);
  });
});

describe("senders", () => {
  const message: PushMessage = { title: "Round 7 locks at 19:30", body: "That's in an hour.", url: "/squad", tag: "deadline-7" };
  const webTarget: PushTarget = { kind: "web", endpoint: WEB_DEVICE.endpoint, webKeys: WEB_DEVICE.webKeys };
  const vapid = { publicKey: "pub", privateKey: "priv", subject: "mailto:hello@hoopsfantasy.ie" };

  it("sends Web Push with the payload the service worker reads", async () => {
    const send = vi.fn(async () => ({ statusCode: 201, body: "", headers: {} }));
    expect(await webPushSender(vapid, send as never).send(webTarget, message)).toBe("sent");
    expect(JSON.parse(webPushPayload(message))).toEqual({
      title: "Round 7 locks at 19:30",
      body: "That's in an hour.",
      url: "/squad",
      tag: "deadline-7",
    });
    expect(send).toHaveBeenCalledWith(
      { endpoint: webTarget.endpoint, keys: webTarget.webKeys },
      webPushPayload(message),
      expect.objectContaining({ TTL: 3600, urgency: "high", topic: "deadline-7", vapidDetails: vapid }),
    );
  });

  it("reports an expired Web Push subscription as unregistered, and other errors as failed", async () => {
    const failing = (status: number) =>
      webPushSender(vapid, (async () => {
        throw new WebPushError("Push failed", status, {}, "", webTarget.endpoint);
      }) as never);
    expect(await failing(410).send(webTarget, message)).toBe("unregistered");
    expect(await failing(404).send(webTarget, message)).toBe("unregistered");
    expect(await failing(500).send(webTarget, message)).toBe("failed");
  });

  it("builds FCM HTTP v1 messages for both platforms", () => {
    expect(fcmMessage("token-123", message)).toEqual({
      message: {
        token: "token-123",
        notification: { title: "Round 7 locks at 19:30", body: "That's in an hour." },
        data: { url: "/squad" },
        android: { priority: "high", ttl: "3600s", notification: { tag: "deadline-7", click_action: "OPEN_URL" } },
        apns: {
          headers: { "apns-priority": "10", "apns-collapse-id": "deadline-7" },
          payload: { aps: { sound: "default", "thread-id": "deadline-7" } },
        },
      },
    });
  });

  it("signs in to Firebase with the service account, then sends", async () => {
    const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
    const account = {
      projectId: "hoops-fantasy",
      clientEmail: "sender@hoops-fantasy.iam.gserviceaccount.com",
      privateKey: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
    };
    let sendStatus = 200;
    let sendBody: unknown = { name: "projects/hoops-fantasy/messages/1" };
    const fetch = vi.fn<typeof globalThis.fetch>(async (url) => {
      if (String(url).startsWith("https://oauth2.googleapis.com/token")) {
        return Response.json({ access_token: "ya29.token", expires_in: 3600 });
      }
      return Response.json(sendBody, { status: sendStatus });
    });
    const fcmTarget: PushTarget = { kind: "fcm", endpoint: "fcm-token-abc", webKeys: null };
    const sender = fcmSender(account, { fetch });

    expect(await sender.send(fcmTarget, message)).toBe("sent");
    const [tokenUrl, tokenInit] = fetch.mock.calls[0];
    expect(tokenUrl).toBe("https://oauth2.googleapis.com/token");
    const assertion = new URLSearchParams(String(tokenInit!.body)).get("assertion")!;
    const [header, claims, signature] = assertion.split(".");
    expect(JSON.parse(Buffer.from(claims, "base64url").toString())).toMatchObject({
      iss: account.clientEmail,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
    });
    expect(
      createVerify("RSA-SHA256").update(`${header}.${claims}`).verify(publicKey, Buffer.from(signature, "base64url")),
    ).toBe(true);
    const [sendUrl, sendInit] = fetch.mock.calls[1];
    expect(sendUrl).toBe("https://fcm.googleapis.com/v1/projects/hoops-fantasy/messages:send");
    expect((sendInit!.headers as Record<string, string>).Authorization).toBe("Bearer ya29.token");
    expect(JSON.parse(String(sendInit!.body))).toEqual(fcmMessage("fcm-token-abc", message));

    // The token is reused, and an uninstalled app's token is reported as unregistered.
    sendStatus = 404;
    sendBody = { error: { status: "NOT_FOUND", details: [{ errorCode: "UNREGISTERED" }] } };
    expect(await sender.send(fcmTarget, message)).toBe("unregistered");
    expect(fetch).toHaveBeenCalledTimes(3);
    sendStatus = 503;
    sendBody = { error: { status: "UNAVAILABLE" } };
    expect(await sender.send(fcmTarget, message)).toBe("failed");
  });
});

describe("deadline reminders", () => {
  const due = async (at: Date) => (await dueDeadlineReminders(db, at)).map((n) => n.kind);

  it("sends nothing to users who haven't turned notifications on", async () => {
    expect(await due(before(HOUR))).toEqual([]);
  });

  it("sends the 1-hour reminder on time or up to 15 minutes early, never late", async () => {
    await optIn(niamh);
    expect(await due(before(HOUR))).toEqual(["deadline_1h"]);
    expect(await due(before(75 * MIN))).toEqual(["deadline_1h"]);
    expect(await due(before(76 * MIN))).toEqual([]);
    expect(await due(before(59 * MIN))).toEqual([]);
    expect(await due(LOCK)).toEqual([]);
  });

  it("sends the 24-hour reminder the same way", async () => {
    await optIn(niamh);
    expect(await due(before(DAY))).toEqual(["deadline_24h"]);
    expect(await due(before(DAY + 15 * MIN))).toEqual(["deadline_24h"]);
    expect(await due(before(DAY + 16 * MIN))).toEqual([]);
    expect(await due(before(DAY - MIN))).toEqual([]);
  });

  it("says when the round locks, in Irish time", async () => {
    await optIn(niamh);
    const [oneHour] = await dueDeadlineReminders(db, before(HOUR));
    expect(messageFor(oneHour)).toEqual({
      title: "Round 7 locks at 19:30",
      body: "That's in an hour. Last chance to change your squad.",
      url: "/squad",
      tag: `deadline-${round7}`,
    });
    const [oneDay] = await dueDeadlineReminders(db, before(DAY));
    expect(messageFor(oneDay).body).toBe("That's Sat 24 Oct. Check your squad and captain before then.");
  });

  it("follows a moved deadline, without repeating the old one's reminders", async () => {
    await optIn(niamh);
    const { sender, sent } = fakeSender();
    await runNotificationPass(db, sender, before(DAY));
    expect(sent.map((s) => s.message.title)).toEqual(["Round 7 locks at 19:30"]);

    // The first game moves 2 hours later, so the round now locks at 21:30.
    await db.query(`update fixtures set tip_off = tip_off + interval '2 hours' where id = $1`, [firstGame]);
    const newLock = new Date(LOCK.getTime() + 2 * HOUR);
    await runNotificationPass(db, sender, before(HOUR)); // the old 1-hour mark: nothing
    await runNotificationPass(db, sender, new Date(newLock.getTime() - DAY));
    await runNotificationPass(db, sender, new Date(newLock.getTime() - HOUR));
    await runNotificationPass(db, sender, new Date(newLock.getTime() - HOUR + 5 * MIN));
    expect(sent.map((s) => s.message.title)).toEqual([
      "Round 7 locks at 19:30",
      "Round 7 locks at 21:30",
      "Round 7 locks at 21:30",
    ]);
  });
});

describe("round results", () => {
  /** Round 7 is over: Niamh scored 212.5 (player 2), with captain player 16 scoring 0. */
  async function finishRound7(postponeSecondGame = false) {
    await db.query(`update fixtures set status = 'final'`);
    if (postponeSecondGame) await db.query(`update fixtures set status = 'postponed' where id <> $1`, [firstGame]);
    await db.query(
      `insert into player_fantasy_points (player_id, fixture_id, round_id, points, is_final, calculated_at)
       values (2, $1, $2, 212.5, true, now())`,
      [firstGame, round7],
    );
    await db.query(
      `with s as (insert into squads (user_id, round_id, captain_player_id, saved_at) values ($1, $2, 16, now()) returning id)
       insert into squad_players (squad_id, player_id, price_at_pick) select id, p, 4 from s, unnest(array[2, 16]) p`,
      [niamh, round7],
    );
    await refreshUserScores(db);
  }
  const SUNDAY_MORNING = new Date("2026-10-25T10:00:00Z"); // 10:00 GMT, clocks went back overnight

  it("sends each user their score once every fixture is final", async () => {
    await optIn(niamh);
    expect(await dueRoundResults(db, SUNDAY_MORNING)).toEqual([]);
    await finishRound7();
    const [n] = await dueRoundResults(db, SUNDAY_MORNING);
    expect(messageFor(n)).toEqual({
      title: "Round 7 results",
      body: "You scored 212.5 points. See how your players did.",
      url: "/results",
      tag: `results-${round7}`,
    });
  });

  it("doesn't wait for a postponed game", async () => {
    await optIn(niamh);
    await finishRound7(true);
    expect(await dueRoundResults(db, SUNDAY_MORNING)).toHaveLength(1);
  });

  it("holds results finished late at night until 08:00", async () => {
    await optIn(niamh);
    await finishRound7();
    const { sender, sent } = fakeSender();
    // The last game ends 22:15 Saturday (IST).
    await runNotificationPass(db, sender, new Date("2026-10-24T21:15:00Z"));
    await runNotificationPass(db, sender, new Date("2026-10-25T07:45:00Z")); // 07:45 GMT
    expect(sent).toEqual([]);
    await runNotificationPass(db, sender, new Date("2026-10-25T08:00:00Z")); // 08:00 GMT
    expect(sent.map((s) => s.message.title)).toEqual(["Round 7 results"]);
    expect([22, 7, 8].map((h) => inQuietHours(new Date(Date.UTC(2026, 11, 1, h))))).toEqual([true, true, false]);
  });

  it("sends results but no reminders to someone who turned reminders off", async () => {
    await optIn(niamh, { deadlineReminders: false, roundResults: true });
    expect(await dueDeadlineReminders(db, before(HOUR))).toEqual([]);
    await finishRound7();
    expect(await dueRoundResults(db, SUNDAY_MORNING)).toHaveLength(1);
  });

  it("doesn't send an old round's result to someone who turns notifications on later", async () => {
    await finishRound7();
    await optIn(niamh, undefined, new Date("2026-10-27T12:00:00Z"));
    expect(await dueRoundResults(db, new Date("2026-10-27T12:15:00Z"))).toEqual([]);
  });
});

describe("sending", () => {
  beforeEach(() => optIn(niamh));

  it("sends once even when the job runs again", async () => {
    const { sender, sent } = fakeSender();
    expect(await runNotificationPass(db, sender, before(HOUR + 10 * MIN))).toEqual({ sent: 1, failed: 0, removed: 0 });
    expect(await runNotificationPass(db, sender, before(HOUR))).toEqual({ sent: 0, failed: 0, removed: 0 });
    expect(sent).toHaveLength(1);
  });

  it("retries a failed send on the next tick", async () => {
    let outcome: SendOutcome = "failed";
    const { sender, sent } = fakeSender(() => outcome);
    expect(await runNotificationPass(db, sender, before(HOUR + 15 * MIN))).toMatchObject({ failed: 1 });
    outcome = "sent";
    expect(await runNotificationPass(db, sender, before(HOUR))).toMatchObject({ sent: 1 });
    expect(sent).toHaveLength(2);
  });

  it("removes a device the push service says is gone", async () => {
    const { sender } = fakeSender("unregistered");
    expect(await runNotificationPass(db, sender, before(HOUR))).toMatchObject({ removed: 1 });
    expect(await count(db, "push_subscriptions")).toBe(0);
    expect(await dueDeadlineReminders(db, before(HOUR))).toEqual([]);
  });
});
