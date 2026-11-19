import type { AppConfig } from "@/lib/config";
import { fcmSender } from "./fcm-sender";
import { combinedSender, type PushSender } from "./sender";
import { webPushSender } from "./web-push-sender";

/** The sender for this environment, or null when no push service is configured. */
export function createPushSender(config: AppConfig): PushSender | null {
  if (!config.vapid && !config.firebase) return null;
  return combinedSender({
    web: config.vapid && webPushSender(config.vapid),
    fcm: config.firebase && fcmSender(config.firebase),
  });
}
