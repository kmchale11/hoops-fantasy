import { connection } from "next/server";
import { APP_ID, androidCertFingerprints } from "@/lib/app-identity";

/**
 * Android App Links: proves this site belongs to the app. Which paths open in the app is set
 * in the app's own manifest (mobile/android), to match APP_LINK_PATHS.
 */
export async function GET() {
  await connection();
  const fingerprints = androidCertFingerprints();
  if (fingerprints.length === 0) return new Response("Not configured", { status: 404 });
  return Response.json([
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: { namespace: "android_app", package_name: APP_ID, sha256_cert_fingerprints: fingerprints },
    },
  ]);
}
