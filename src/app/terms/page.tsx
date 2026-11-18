import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Terms · Hoops Fantasy" };

// DRAFT: placeholder wording so the sign-up checkbox links somewhere real. Replace with
// reviewed terms and a privacy notice before launch.
export default function TermsPage() {
  return (
    <main>
      <p className="muted">
        <Link href="/">Hoops Fantasy</Link>
      </p>
      <h1>Terms</h1>
      <p className="muted">Draft. Full terms will be published before launch.</p>
      <ul>
        <li>Hoops Fantasy is free to play. There is no entry fee and there are no cash prizes.</li>
        <li>You must be 18 or over to play.</li>
        <li>
          We keep your email address, manager name, team name, when you agreed to these terms and
          your game data, and nothing else. You can see all of it on your account page.
        </li>
        <li>You can delete your account at any time, which removes your data.</li>
        <li>Manager and team names are public. Don&apos;t use anything offensive or impersonate anyone.</li>
      </ul>
    </main>
  );
}
