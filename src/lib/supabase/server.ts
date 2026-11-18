import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { loadConfig } from "@/lib/config";

/** True when Supabase Auth is configured. Without it every visitor is treated as signed out. */
export function authConfigured(): boolean {
  const { supabaseUrl, supabasePublishableKey } = loadConfig();
  return Boolean(supabaseUrl && supabasePublishableKey);
}

/** Supabase client acting as the visitor, using their session cookies. */
export async function createClient() {
  const { supabaseUrl, supabasePublishableKey } = loadConfig();
  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error("Supabase Auth isn't configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.");
  }
  const cookieStore = await cookies();
  return createServerClient(supabaseUrl, supabasePublishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          for (const { name, value, options } of toSet) cookieStore.set(name, value, options);
        } catch {
          // Server Components can't set cookies; the proxy refreshes the session instead.
        }
      },
    },
  });
}

/** Admin client with the secret key. Server only, and only for actions on the caller's own account. */
export function createAdminClient() {
  const { supabaseUrl, supabaseSecretKey } = loadConfig();
  if (!supabaseUrl || !supabaseSecretKey) {
    throw new Error("SUPABASE_SECRET_KEY isn't set, so accounts can't be deleted.");
  }
  return createSupabaseClient(supabaseUrl, supabaseSecretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
