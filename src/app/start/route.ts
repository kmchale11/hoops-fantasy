import { redirect } from "next/navigation";
import { getAccount } from "@/lib/session";

/**
 * Where the installed app opens: the squad for signed-in users, the home page for everyone
 * else (rather than the sign-in screen /squad would send them to).
 */
export async function GET() {
  const account = await getAccount();
  redirect(account.status === "signed-out" ? "/" : "/squad");
}
