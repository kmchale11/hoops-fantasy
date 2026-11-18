"use server";

import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { createAdminClient, createClient } from "@/lib/supabase/server";

export type DeleteState = { error?: string };

/**
 * Permanently deletes the signed-in user. Deleting the Supabase Auth user cascades to their
 * profile, and later changes cascade squads and league memberships from it too.
 */
export async function deleteAccount(_prev: DeleteState, formData: FormData): Promise<DeleteState> {
  const user = await getSessionUser();
  if (!user) redirect("/sign-in?next=/account");
  if (formData.get("confirm") !== "on") {
    return { error: "Tick the box to confirm you want to delete your account" };
  }

  const { error } = await createAdminClient().auth.admin.deleteUser(user.id);
  if (error) return { error: "We couldn't delete your account. Please try again." };

  // The user no longer exists; this just clears the session cookies in this browser.
  await (await createClient()).auth.signOut({ scope: "local" });
  redirect("/account/deleted");
}
