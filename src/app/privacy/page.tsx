import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Privacy" };

// DRAFT: describes what the code stores today, for the store privacy forms and sign-up. Have
// it reviewed, and fill in the controller's name and contact address, before launch.
export default function PrivacyPage() {
  return (
    <main>
      <h1>Privacy</h1>
      <p className="muted">Draft. A reviewed privacy notice will be published before launch.</p>

      <h2>What we keep</h2>
      <ul>
        <li>
          <strong>Your account:</strong> your email address (or your Google account&apos;s email if you
          sign in with Google), your manager name and team name, and when you confirmed you&apos;re 18 or
          over and accepted the <Link href="/terms">terms</Link>.
        </li>
        <li>
          <strong>Your game data:</strong> your squads, captains, transfers, scores and the mini leagues
          you&apos;re in.
        </li>
        <li>
          <strong>Notifications, only if you turn them on:</strong> which kinds you want (deadline
          reminders, round results) and, for each browser or phone you turn them on in, a device
          address that lets us send to it. For the website this is a Web Push subscription; in the
          iPhone and Android apps it&apos;s a Firebase Cloud Messaging token. We also record which
          notifications we&apos;ve sent to each device so none is sent twice.
        </li>
        <li>
          <strong>Signing in:</strong> a cookie that keeps you signed in. We don&apos;t use advertising
          or analytics cookies.
        </li>
        <li>
          <strong>On your device only:</strong> if you dismiss the &ldquo;install the app&rdquo; offer, your
          browser remembers that for 30 days. It isn&apos;t sent to us.
        </li>
      </ul>

      <h2>What we use it for</h2>
      <p>
        Only to run the game: signing you in, saving your squad, scoring it, showing standings, and
        sending the notifications you asked for. We don&apos;t sell your data or use it for advertising.
        Manager and team names appear on leaderboards and in your leagues; your email address
        doesn&apos;t.
      </p>

      <h2>Who else handles it</h2>
      <ul>
        <li>Supabase stores the database and handles sign-in.</li>
        <li>Vercel hosts the website.</li>
        <li>Google, if you sign in with Google.</li>
        <li>
          To deliver notifications, the push service your browser or phone uses: Google (Chrome,
          Android and Firebase), Apple (Safari and iPhone), Mozilla (Firefox) or Microsoft (Edge).
          They receive the notification&apos;s text and the device address, not your account details.
        </li>
      </ul>

      <h2>How long we keep it</h2>
      <ul>
        <li>Your account and game data: until you delete your account.</li>
        <li>
          A device address: until you turn notifications off in that browser or app, the push service
          tells us the device is gone, someone else signs in on it, or you delete your account.
        </li>
      </ul>

      <h2>Your choices</h2>
      <ul>
        <li>
          See everything we hold about you on your <Link href="/account">account page</Link>.
        </li>
        <li>
          Turn notifications, or either kind, off at any time in{" "}
          <Link href="/account/notifications">notification settings</Link> or your phone&apos;s settings.
        </li>
        <li>Delete your account from the account page, which removes all of the above.</li>
        <li>
          You can also ask for a copy of your data, or complain to the Irish Data Protection
          Commission.
        </li>
      </ul>
    </main>
  );
}
