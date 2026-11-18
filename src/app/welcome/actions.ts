"use server";

import { redirect } from "next/navigation";
import { createProfile, type SignUpErrors } from "@/accounts/profile";
import { safeNext } from "@/lib/guards";
import { getDb } from "@/lib/server-db";
import { getSessionUser } from "@/lib/session";

export interface SignUpState {
  errors: SignUpErrors;
  values: { managerName: string; teamName: string };
}

export async function completeSignUp(_prev: SignUpState, formData: FormData): Promise<SignUpState> {
  const user = await getSessionUser();
  if (!user) redirect("/sign-in?next=/welcome");

  const input = {
    managerName: String(formData.get("managerName") ?? ""),
    teamName: String(formData.get("teamName") ?? ""),
    ageConfirmed: formData.get("ageConfirmed") === "on",
    termsAccepted: formData.get("termsAccepted") === "on",
  };
  const result = await createProfile(getDb(), user.id, input, new Date());
  if (!result.ok) {
    return { errors: result.errors, values: { managerName: input.managerName, teamName: input.teamName } };
  }
  redirect(safeNext(String(formData.get("next") ?? "")));
}
