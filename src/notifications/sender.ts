/** What a notification says and where tapping it goes. */
export interface PushMessage {
  title: string;
  body: string;
  /** A path on this site: /squad or /results. */
  url: string;
  /** Notifications with the same tag replace each other on the device. */
  tag: string;
}

/** One browser or phone, as stored in push_subscriptions. */
export interface PushTarget {
  kind: "web" | "fcm";
  /** The Web Push endpoint URL, or the FCM registration token. */
  endpoint: string;
  webKeys: { p256dh: string; auth: string } | null;
}

/**
 * "unregistered": the service says the device is gone (app uninstalled, permission revoked),
 * so stop sending to it. "failed": anything else, worth retrying on the next tick.
 */
export type SendOutcome = "sent" | "unregistered" | "failed";

export interface PushSender {
  send(target: PushTarget, message: PushMessage): Promise<SendOutcome>;
}

/** Routes each device to the service it registered with. */
export function combinedSender(senders: { web?: PushSender; fcm?: PushSender }): PushSender {
  return {
    async send(target, message) {
      const sender = senders[target.kind];
      // Not configured in this environment: leave it for a tick when it is.
      return sender ? sender.send(target, message) : "failed";
    },
  };
}
