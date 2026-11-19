import { sendNotification, WebPushError } from "web-push";
import type { PushMessage, PushSender, PushTarget, SendOutcome } from "./sender";

export interface VapidKeys {
  publicKey: string;
  privateKey: string;
  /** A mailto: or https: contact for the push services, required by VAPID. */
  subject: string;
}

/** The JSON the service worker's push handler reads. */
export function webPushPayload(message: PushMessage): string {
  return JSON.stringify({ title: message.title, body: message.body, url: message.url, tag: message.tag });
}

export const WEB_PUSH_OPTIONS = {
  // Deadline reminders are useless once the round has locked, so don't hold them for long.
  TTL: 60 * 60,
  urgency: "high" as const,
};

type Send = typeof sendNotification;

/** Sends through the browser's push service (Web Push with VAPID), for websites and installed web apps. */
export function webPushSender(vapid: VapidKeys, send: Send = sendNotification): PushSender {
  return {
    async send(target: PushTarget, message: PushMessage): Promise<SendOutcome> {
      if (!target.webKeys) return "unregistered";
      try {
        await send({ endpoint: target.endpoint, keys: target.webKeys }, webPushPayload(message), {
          ...WEB_PUSH_OPTIONS,
          topic: message.tag,
          vapidDetails: vapid,
        });
        return "sent";
      } catch (error) {
        // 404 and 410 mean the subscription has expired or been removed.
        if (error instanceof WebPushError && (error.statusCode === 404 || error.statusCode === 410)) {
          return "unregistered";
        }
        return "failed";
      }
    },
  };
}
