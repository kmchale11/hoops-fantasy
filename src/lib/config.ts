export const FEED_SOURCES = ["mock", "nbn23"] as const;
export type FeedSource = (typeof FEED_SOURCES)[number];

export interface AppConfig {
  feedSource: FeedSource;
  /** Which stage of the mock season to serve (1–3). Only used when feedSource is "mock". */
  mockStage: 1 | 2 | 3;
  /** Postgres connection string (Supabase "Session pooler" URL in production). */
  databaseUrl: string | undefined;
  /** Shared secret the scheduler sends as a Bearer token to the cron endpoint. */
  cronSecret: string | undefined;
  /** Supabase project URL and publishable (anon) key, for sign-in. */
  supabaseUrl: string | undefined;
  supabasePublishableKey: string | undefined;
  /** Supabase secret (service role) key. Server only: used to delete accounts. */
  supabaseSecretKey: string | undefined;
  /** Web Push keys, for notifications on the website and installed web app. */
  vapid: { publicKey: string; privateKey: string; subject: string } | undefined;
  /** Firebase service account, for notifications in the iOS and Android apps. */
  firebase: { projectId: string; clientEmail: string; privateKey: string } | undefined;
}

type Env = Record<string, string | undefined>;

export function loadConfig(env: Env = process.env): AppConfig {
  const rawSource = (env.FEED_SOURCE ?? "mock").trim().toLowerCase();
  if (!FEED_SOURCES.includes(rawSource as FeedSource)) {
    throw new Error(
      `FEED_SOURCE must be one of ${FEED_SOURCES.join(", ")} (got "${env.FEED_SOURCE}")`,
    );
  }

  const rawStage = Number(env.MOCK_STAGE ?? "3");
  if (![1, 2, 3].includes(rawStage)) {
    throw new Error(`MOCK_STAGE must be 1, 2 or 3 (got "${env.MOCK_STAGE}")`);
  }

  return {
    feedSource: rawSource as FeedSource,
    mockStage: rawStage as 1 | 2 | 3,
    databaseUrl: env.DATABASE_URL || undefined,
    cronSecret: env.CRON_SECRET || undefined,
    supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL || undefined,
    supabasePublishableKey: env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || undefined,
    supabaseSecretKey: env.SUPABASE_SECRET_KEY || undefined,
    vapid:
      env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT
        ? { publicKey: env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, privateKey: env.VAPID_PRIVATE_KEY, subject: env.VAPID_SUBJECT }
        : undefined,
    firebase:
      env.FIREBASE_PROJECT_ID && env.FIREBASE_CLIENT_EMAIL && env.FIREBASE_PRIVATE_KEY
        ? {
            projectId: env.FIREBASE_PROJECT_ID,
            clientEmail: env.FIREBASE_CLIENT_EMAIL,
            // Hosting dashboards store the key's line breaks as "\n".
            privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
          }
        : undefined,
  };
}
