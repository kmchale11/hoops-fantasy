import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { safeNext } from "@/lib/guards";
import { createClient } from "@/lib/supabase/server";

const EMAIL_OTP_TYPES: EmailOtpType[] = ["email", "magiclink", "signup"];

/**
 * Where sign-in links land. Magic links arrive with ?token_hash=…&type=email (see
 * supabase/templates/magic-link.html); Google sign-in arrives with ?code=…. On success the
 * visitor goes to `next`, which sends anyone who hasn't finished sign-up to /welcome.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const params = url.searchParams;
  const to = (path: string) => NextResponse.redirect(new URL(path, url.origin));

  // Supabase reports some failures, like an expired link, by redirecting here with error params.
  const reported = params.get("error_code") ?? params.get("error");
  if (reported) return to(`/sign-in?error=${reported === "otp_expired" ? "expired" : "failed"}`);

  const supabase = await createClient();
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;
  const code = params.get("code");

  let result;
  if (tokenHash && type && EMAIL_OTP_TYPES.includes(type)) {
    result = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
  } else if (code) {
    result = await supabase.auth.exchangeCodeForSession(code);
  } else {
    return to("/sign-in?error=failed");
  }

  if (result.error) {
    // Expired and already-used links both come back as otp_expired.
    return to(`/sign-in?error=${result.error.code === "otp_expired" ? "expired" : "failed"}`);
  }
  return to(safeNext(params.get("next")));
}
