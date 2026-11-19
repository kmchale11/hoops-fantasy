import Link from "next/link";

export default function Home() {
  return (
    <main>
      <h1>Hoops Fantasy</h1>
      <p className="muted">Free-to-play fantasy basketball for Irish domestic leagues.</p>
      <p>
        Pick a squad of eight before each round, then compete with everyone and in private leagues
        with your club, workplace or friends.
      </p>
      <p>
        <Link href="/sign-in">Sign in</Link> · <Link href="/squad">Your squad</Link> · <Link href="/results">Results</Link> ·{" "}
        <Link href="/leagues">Leagues</Link> · <Link href="/leaderboard">Leaderboard</Link> ·{" "}
        <Link href="/account">Your account</Link> ·{" "}
        <Link href="/scoring">How scoring works</Link>
      </p>
    </main>
  );
}
