import { vi } from "vitest";
import type { Db } from "@/lib/db";

/**
 * A stand-in for Supabase Auth. Tests set `auth.user` to sign someone in and inspect the
 * mocked calls. Use with:
 *   vi.mock("@/lib/supabase/server", async () => (await import("./helpers/auth")).supabaseServerMock);
 *   vi.mock("@/lib/server-db", async () => (await import("./helpers/auth")).serverDbMock);
 */
export const auth = {
  user: null as { id: string; email: string | null } | null,
  db: undefined as Db | undefined,
  client: {
    auth: {
      getUser: vi.fn(),
      signInWithOtp: vi.fn(),
      signInWithOAuth: vi.fn(),
      verifyOtp: vi.fn(),
      exchangeCodeForSession: vi.fn(),
      signOut: vi.fn(),
    },
  },
  admin: { auth: { admin: { deleteUser: vi.fn() } } },
};

export function resetAuth(db?: Db) {
  auth.user = null;
  auth.db = db;
  const a = auth.client.auth;
  a.getUser.mockReset().mockImplementation(async () =>
    auth.user ? { data: { user: auth.user }, error: null } : { data: { user: null }, error: { message: "No session" } },
  );
  a.signInWithOtp.mockReset().mockResolvedValue({ data: {}, error: null });
  a.signInWithOAuth.mockReset().mockResolvedValue({ data: { url: "https://accounts.google.com/o/oauth2" }, error: null });
  a.verifyOtp.mockReset().mockResolvedValue({ data: {}, error: null });
  a.exchangeCodeForSession.mockReset().mockResolvedValue({ data: {}, error: null });
  a.signOut.mockReset().mockResolvedValue({ error: null });
  auth.admin.auth.admin.deleteUser.mockReset();
}

export const supabaseServerMock = {
  authConfigured: () => true,
  createClient: async () => auth.client,
  createAdminClient: () => auth.admin,
};

export const serverDbMock = {
  getDb: () => {
    if (!auth.db) throw new Error("Call resetAuth(db) with a test database first");
    return auth.db;
  },
};

/** Runs fn and returns where it redirected (Next's redirect() throws), or "404" for notFound(). */
export async function redirectOf(fn: () => unknown): Promise<string | undefined> {
  try {
    await fn();
  } catch (error) {
    const digest = (error as { digest?: string }).digest ?? "";
    if (digest.startsWith("NEXT_REDIRECT")) return digest.split(";")[2];
    if (digest.startsWith("NEXT_HTTP_ERROR_FALLBACK;404")) return "404";
    throw error;
  }
  return undefined;
}

export function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.set(k, v);
  return data;
}
