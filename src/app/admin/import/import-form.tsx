"use client";

import { useEffect, useState } from "react";
import styles from "@/app/forms.module.css";

interface FixtureOption {
  externalId: string;
  tipOff: string;
  status: string;
  home: string;
  away: string;
  statLines: number;
}

interface RowError {
  row: number;
  message: string;
}

type Outcome =
  | { kind: "success"; imported: number }
  | { kind: "rows"; errors: RowError[] }
  | { kind: "error"; message: string };

const TEMPLATE =
  "player_name,team,minutes,pts,reb,ast,stl,blk,tov,fgm,fga,ftm,fta\n" +
  '"Seán Murphy",Ballina Braves,32,21,6,4,1,0,2,8,15,3,4\n';

const dateFormat = new Intl.DateTimeFormat("en-IE", {
  timeZone: "Europe/Dublin",
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export default function ImportForm() {
  const [fixtures, setFixtures] = useState<FixtureOption[] | null>(null);
  const [fixtureId, setFixtureId] = useState("");
  const [csv, setCsv] = useState("");
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  useEffect(() => {
    // The admin session cookie authenticates these requests.
    fetch("/api/admin/fixtures")
      .then(async (res) => {
        if (res.status === 401 || res.status === 403) throw new Error("Your session has ended. Sign in again.");
        if (!res.ok) throw new Error("Couldn't load fixtures.");
        const data = (await res.json()) as { fixtures: FixtureOption[] };
        setFixtures(data.fixtures);
        setFixtureId(data.fixtures.find((f) => f.status !== "postponed")?.externalId ?? "");
      })
      .catch((e) => setOutcome({ kind: "error", message: e instanceof Error ? e.message : String(e) }));
  }, []);

  async function readFile(file: File | undefined) {
    if (file) setCsv(await file.text());
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setOutcome(null);
    try {
      const res = await fetch("/api/admin/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fixtureExternalId: fixtureId, csv }),
      });
      const data = await res.json();
      if (res.ok && data.ok) setOutcome({ kind: "success", imported: data.imported });
      else if (data.errors) setOutcome({ kind: "rows", errors: data.errors });
      else setOutcome({ kind: "error", message: data.error ?? "Import failed." });
    } catch {
      setOutcome({ kind: "error", message: "Couldn't reach the server." });
    } finally {
      setBusy(false);
    }
  }

  if (!fixtures) {
    return (
      <div className={styles.card}>
        {outcome?.kind === "error" ? <p className={styles.error}>{outcome.message}</p> : <p>Loading fixtures…</p>}
      </div>
    );
  }

  return (
    <form className={styles.card} onSubmit={submit}>
      <label className={styles.label} htmlFor="fixture">
        Fixture
      </label>
      <select
        id="fixture"
        className={styles.input}
        value={fixtureId}
        onChange={(e) => setFixtureId(e.target.value)}
      >
        {fixtures.map((f) => (
          <option key={f.externalId} value={f.externalId} disabled={f.status === "postponed"}>
            {dateFormat.format(new Date(f.tipOff))} · {f.home} v {f.away} · {f.status}
            {f.statLines > 0 ? ` · ${f.statLines} lines` : ""}
          </option>
        ))}
      </select>

      <label className={styles.label} htmlFor="file">
        CSV file
      </label>
      <input
        id="file"
        className={styles.input}
        type="file"
        accept=".csv,text/csv"
        onChange={(e) => readFile(e.target.files?.[0])}
      />

      <label className={styles.label} htmlFor="csv">
        Or paste it
      </label>
      <textarea
        id="csv"
        className={`${styles.input} ${styles.textarea}`}
        placeholder={TEMPLATE}
        value={csv}
        onChange={(e) => setCsv(e.target.value)}
        spellCheck={false}
      />
      <p className={styles.hint}>
        Columns: player_name, team, minutes, pts, reb, ast, stl, blk, tov, fgm, fga, ftm, fta.
        Add player_external_id to match players by ID instead of name.
      </p>

      <button className={styles.button} type="submit" disabled={!fixtureId || !csv.trim() || busy}>
        {busy ? "Importing…" : "Import box score"}
      </button>

      {outcome?.kind === "success" && (
        <p className={styles.success}>Imported {outcome.imported} player lines. The fixture is now final.</p>
      )}
      {outcome?.kind === "error" && <p className={styles.error}>{outcome.message}</p>}
      {outcome?.kind === "rows" && (
        <div className={styles.error}>
          <p>Nothing was saved. Fix these and try again:</p>
          <ul>
            {outcome.errors.map((err, i) => (
              <li key={i}>
                {err.row > 0 ? `Row ${err.row}: ` : ""}
                {err.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </form>
  );
}
