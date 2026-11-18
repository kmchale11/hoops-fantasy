import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUser, safeNext } from "@/lib/guards";
import SignUpForm from "./sign-up-form";

export const metadata: Metadata = { title: "Set up your team · Hoops Fantasy" };

export const instant = false;

export default async function WelcomePage({ searchParams }: PageProps<"/welcome">) {
  const params = await searchParams;
  const next = safeNext(typeof params.next === "string" ? params.next : undefined);
  const account = await requireUser(`/welcome?next=${encodeURIComponent(next)}`);
  if (account.status === "ready") redirect(next);

  return (
    <main>
      <h1>Set up your team</h1>
      <p className="muted">One last step before you pick a squad.</p>
      <SignUpForm next={next} />
    </main>
  );
}
