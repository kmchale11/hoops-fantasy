import type { Metadata } from "next";
import Link from "next/link";
import styles from "@/app/forms.module.css";
import { requireUser } from "@/lib/guards";
import { signOut } from "../sign-in/actions";
import DeleteForm from "./delete-form";

export const metadata: Metadata = { title: "Your account · Hoops Fantasy", robots: { index: false } };

export const instant = false;

const when = new Intl.DateTimeFormat("en-IE", {
  timeZone: "Europe/Dublin",
  dateStyle: "long",
  timeStyle: "short",
});

/** Shows every piece of personal data held about the user (GDPR transparency). */
export default async function AccountPage() {
  const account = await requireUser("/account");
  const profile = account.status === "ready" ? account.profile : null;

  return (
    <main>
      <p className="muted">
        <Link href="/">Hoops Fantasy</Link>
      </p>
      <h1>Your account</h1>
      <p className="muted">This is all the personal information we hold about you.</p>

      <dl className={styles.details}>
        <dt>Email</dt>
        <dd>{account.user.email ?? "None (signed in with Google without an email)"}</dd>
        <dt>Manager name</dt>
        <dd>{profile?.managerName ?? "Not set"}</dd>
        <dt>Team name</dt>
        <dd>{profile?.teamName ?? "Not set"}</dd>
        <dt>Confirmed 18 or over</dt>
        <dd>{profile ? when.format(profile.ageConfirmedAt) : "Not yet"}</dd>
        <dt>Accepted the terms</dt>
        <dd>{profile ? when.format(profile.termsAcceptedAt) : "Not yet"}</dd>
        {profile?.isAdmin && (
          <>
            <dt>Role</dt>
            <dd>Admin</dd>
          </>
        )}
      </dl>
      {!profile && (
        <p>
          <Link href="/welcome?next=/account">Finish setting up your team</Link>
        </p>
      )}
      <p className="muted">
        Your squads and league memberships are your game data, shown where you play. If you turn on
        notifications, we also keep an address for each device you get them on.
      </p>
      {profile && (
        <p>
          <Link href="/account/notifications">Notification settings</Link>
        </p>
      )}

      <form action={signOut}>
        <button className={styles.secondary} type="submit">
          Sign out
        </button>
      </form>

      <h2 style={{ fontSize: "1.15rem", margin: "32px 0 8px" }}>Delete account</h2>
      <DeleteForm />
    </main>
  );
}
