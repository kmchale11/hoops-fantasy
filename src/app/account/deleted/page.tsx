import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Account deleted · Hoops Fantasy", robots: { index: false } };

export default function AccountDeletedPage() {
  return (
    <main>
      <h1>Your account has been deleted</h1>
      <p>Your profile and personal data have been removed and you&apos;ve been signed out.</p>
      <p>
        <Link href="/">Back to Hoops Fantasy</Link>
      </p>
    </main>
  );
}
