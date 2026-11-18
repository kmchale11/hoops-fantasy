import Link from "next/link";

export default function Home() {
  return (
    <main>
      <h1>Hoops Fantasy</h1>
      <p className="muted">Free-to-play fantasy basketball for Irish domestic leagues.</p>
      <p>
        Squads and leagues are on the way. For now this app syncs league data in the background
        and scores every player&apos;s games.
      </p>
      <p>
        <Link href="/sign-in">Sign in</Link> · <Link href="/squad">Your squad</Link> · <Link href="/results">Results</Link> ·{" "}
        <Link href="/account">Your account</Link> ·{" "}
        <Link href="/scoring">How scoring works</Link>
      </p>
    </main>
  );
}
