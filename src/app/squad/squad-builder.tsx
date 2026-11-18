"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import styles from "@/app/forms.module.css";
import type { PlayerListing } from "@/squads/players";
import { BUDGET, SQUAD_SIZE, squadRuleErrors } from "@/squads/rules";
import { saveSquadAction, type SaveSquadState } from "./actions";
import local from "./squad.module.css";

export interface BuilderRound {
  name: string;
  /** ISO timestamp. */
  deadline: string;
}

export interface SquadBuilderProps {
  players: PlayerListing[];
  initialPlayerIds: number[];
  initialCaptainId: number | null;
  /** The round being picked for; null when none is scheduled. */
  open: BuilderRound | null;
  /** The round in progress, during which changes are locked. */
  locked: BuilderRound | null;
  /** Name of the round the points column shows. */
  pointsRound: string | null;
  /** Server time as an ISO timestamp, so the first render matches on server and client. */
  now: string;
}

const deadlineFormat = new Intl.DateTimeFormat("en-IE", {
  timeZone: "Europe/Dublin",
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDeadline(iso: string): string {
  return deadlineFormat.format(new Date(iso));
}

/** "2 days 3 hours", "3 hours 12 minutes", "45 minutes", "less than a minute". */
export function timeUntil(ms: number): string {
  const minutes = Math.floor(ms / 60_000);
  const plural = (n: number, unit: string) => `${n} ${unit}${n === 1 ? "" : "s"}`;
  if (minutes < 1) return "less than a minute";
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  if (days > 0) return hours ? `${plural(days, "day")} ${plural(hours, "hour")}` : plural(days, "day");
  if (hours > 0) return mins ? `${plural(hours, "hour")} ${plural(mins, "minute")}` : plural(hours, "hour");
  return plural(mins, "minute");
}

function Countdown({ deadline, now }: { deadline: string; now: string }) {
  const [current, setCurrent] = useState(() => new Date(now).getTime());
  useEffect(() => {
    const timer = setInterval(() => setCurrent(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  const left = new Date(deadline).getTime() - current;
  return <>{left > 0 ? `locks in ${timeUntil(left)}` : "has locked. Reload to see the latest."}</>;
}

const credits = (n: number) => n.toFixed(1);

export default function SquadBuilder(props: SquadBuilderProps) {
  const { players, open, locked, pointsRound, now } = props;
  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const [picked, setPicked] = useState<number[]>(() => props.initialPlayerIds.filter((id) => byId.has(id)));
  const [captain, setCaptain] = useState<number | null>(props.initialCaptainId);
  const [search, setSearch] = useState("");
  const [team, setTeam] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [state, action, pending] = useActionState<SaveSquadState, FormData>(saveSquadAction, {
    errors: [],
    savedAt: null,
  });

  const editable = open !== null && locked === null;
  const squad = picked.map((id) => byId.get(id)!);
  const errors = squadRuleErrors(squad, captain);
  const spent = squad.reduce((sum, p) => sum + Math.round((p.price ?? 0) * 10), 0) / 10;
  const teams = [...new Map(players.filter((p) => p.teamId).map((p) => [p.teamId, p.teamName!])).entries()];

  const shown = players.filter(
    (p) =>
      (!search || p.name.toLowerCase().includes(search.trim().toLowerCase())) &&
      (!team || String(p.teamId) === team) &&
      (!maxPrice || (p.price !== null && p.price <= Number(maxPrice))),
  );

  function toggle(id: number) {
    if (picked.includes(id)) {
      setPicked(picked.filter((p) => p !== id));
      if (captain === id) setCaptain(null);
    } else {
      setPicked([...picked, id]);
    }
  }

  return (
    <div className={local.builder}>
      <section className={styles.notice} aria-live="polite">
        {locked ? (
          <p className={local.flush}>
            <strong>{locked.name}</strong> locked at {formatDeadline(locked.deadline)}. You can make changes once
            its last game ends.
          </p>
        ) : open ? (
          <p className={local.flush}>
            Picking for <strong>{open.name}</strong>. Deadline {formatDeadline(open.deadline)}: your squad{" "}
            <Countdown deadline={open.deadline} now={now} />
          </p>
        ) : (
          <p className={local.flush}>There&apos;s no upcoming round to pick a squad for yet.</p>
        )}
      </section>

      <form className={styles.card} action={action}>
        <h2 className={local.h2}>
          Your squad <span className="muted">({picked.length}/{SQUAD_SIZE})</span>
        </h2>
        <p className={local.budget}>
          Spent {credits(spent)} of {credits(BUDGET)} credits ·{" "}
          <strong className={spent > BUDGET ? local.over : undefined}>{credits(BUDGET - spent)} left</strong>
        </p>

        {squad.length === 0 ? (
          <p className="muted">Add {SQUAD_SIZE} players from the list below.</p>
        ) : (
          <ul className={local.squad}>
            {squad.map((p) => (
              <li key={p.id}>
                <label className={local.captain}>
                  <input
                    type="radio"
                    name="captain-choice"
                    checked={captain === p.id}
                    onChange={() => setCaptain(p.id)}
                    disabled={!editable}
                  />
                  <span>
                    {p.name} <span className="muted">· {p.teamShort ?? "No team"}</span>
                    {captain === p.id && <span className={local.badge}>C</span>}
                  </span>
                </label>
                <span className={local.num}>{p.price === null ? "–" : credits(p.price)}</span>
                {editable && (
                  <button type="button" className={local.remove} onClick={() => toggle(p.id)}>
                    Remove<span className={local.sr}> {p.name}</span>
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {squad.length > 0 && <p className={styles.hint}>Tick your captain. Their points count double.</p>}

        {editable && errors.length > 0 && (
          <ul className={local.rules} aria-label="Still to fix">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}

        <input type="hidden" name="players" value={picked.join(",")} />
        <input type="hidden" name="captain" value={captain ?? ""} />
        {editable && (
          <button className={styles.button} type="submit" disabled={pending || errors.length > 0}>
            {pending ? "Saving…" : "Save squad"}
          </button>
        )}
        {state.errors.length > 0 && (
          <div className={styles.error}>
            <p>Your squad wasn&apos;t saved:</p>
            <ul>
              {state.errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
        )}
        {state.savedAt && state.errors.length === 0 && <p className={styles.success}>Squad saved.</p>}
      </form>

      <section className={styles.card}>
        <h2 className={local.h2}>Players</h2>
        <div className={local.filters}>
          <label>
            <span className={local.sr}>Search by name</span>
            <input
              className={styles.input}
              type="search"
              placeholder="Search by name"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <label>
            <span className={local.sr}>Team</span>
            <select className={styles.input} value={team} onChange={(e) => setTeam(e.target.value)}>
              <option value="">All teams</option>
              {teams.map(([id, name]) => (
                <option key={id} value={id!}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className={local.sr}>Maximum price</span>
            <select className={styles.input} value={maxPrice} onChange={(e) => setMaxPrice(e.target.value)}>
              <option value="">Any price</option>
              {[6, 8, 10, 12].map((n) => (
                <option key={n} value={n}>
                  Up to {credits(n)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <table className={local.table}>
          <thead>
            <tr>
              <th scope="col">Player</th>
              <th scope="col" className={local.num}>
                Price
              </th>
              <th scope="col" className={local.num} title={pointsRound ?? undefined}>
                {pointsRound ? "Last round" : "Points"}
              </th>
              <th scope="col">
                <span className={local.sr}>Pick</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {shown.map((p) => {
              const isPicked = picked.includes(p.id);
              return (
                <tr key={p.id} className={p.available ? undefined : local.unavailable}>
                  <th scope="row">
                    {p.name}
                    <span className={local.team}>{p.teamName ?? "No team"}</span>
                  </th>
                  <td className={local.num}>{p.price === null ? "–" : credits(p.price)}</td>
                  <td className={local.num}>{p.roundPoints === null ? "–" : p.roundPoints.toFixed(1)}</td>
                  <td className={local.num}>
                    {!p.available ? (
                      <span className="muted">Unavailable</span>
                    ) : (
                      <button
                        type="button"
                        className={isPicked ? local.remove : local.add}
                        onClick={() => toggle(p.id)}
                        disabled={!editable || (!isPicked && picked.length >= SQUAD_SIZE)}
                      >
                        {isPicked ? "Remove" : "Add"}
                        <span className={local.sr}> {p.name}</span>
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {shown.length === 0 && <p className="muted">No players match those filters.</p>}
      </section>
    </div>
  );
}
