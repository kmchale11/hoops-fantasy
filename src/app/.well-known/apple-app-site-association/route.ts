import { connection } from "next/server";
import { APP_ID, APP_LINK_PATHS, appleTeamId } from "@/lib/app-identity";

/** iOS Universal Links: tells iPhones to open invite and sign-in links in the app. */
export async function GET() {
  await connection();
  const team = appleTeamId();
  if (!team) return new Response("Not configured", { status: 404 });
  return Response.json({
    applinks: {
      details: [{ appIDs: [`${team}.${APP_ID}`], components: APP_LINK_PATHS.map((path) => ({ "/": path })) }],
    },
  });
}
