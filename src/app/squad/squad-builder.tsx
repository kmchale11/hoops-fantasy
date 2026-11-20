"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import ReminderCard from "@/app/account/notifications/reminder-card";
import type { PlayerListing } from "@/squads/players";
import { BUDGET, MAX_PER_TEAM, POSITION_NAMES, SQUAD_SIZE, squadRuleErrors } from "@/squads/rules";
import { budgetLeft, fillSlots, fits, openSlots, pickProblem, SLOT_LABELS, SLOT_ORDER, type Slot } from "@/squads/slots";
import { saveSquadAction, type SaveSquadState } from "./actions";
import styles from "./squad.module.css";

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
  /** Web Push public key; null when notifications aren't set up, so none are offered. */
  vapidPublicKey?: string | null;
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
const points = (n: number | null) => (n === null ? "–" : n.toFixed(1));

/** A slot's empty card label: "Add a guard", "Add a flex player". */
const ADD_LABEL: Record<Slot, string> = {
  G: "Add a guard",
  F: "Add a forward",
  C: "Add a centre",
  FLEX: "Add a flex player",
};

function ClubBadge({ player }: { player: PlayerListing }) {
  return (
    <span className={styles.club} aria-hidden="true">
      {player.teamShort ?? "–"}
    </span>
  );
}

export default function SquadBuilder(props: SquadBuilderProps) {
  const { players, open, locked, pointsRound, now } = props;
  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const [picked, setPicked] = useState<number[]>(() => props.initialPlayerIds.filter((id) => byId.has(id)));
  const [captain, setCaptain] = useState<number | null>(props.initialCaptainId);
  /** The slot being picked for, which shows the player picker in place of the squad. */
  const [picking, setPicking] = useState<Slot | null>(null);
  const [state, action, pending] = useActionState<SaveSquadState, FormData>(saveSquadAction, {
    errors: [],
    savedAt: null,
  });

  // Switching between the squad and the picker starts at the top of the page.
  useEffect(() => window.scrollTo(0, 0), [picking]);

  const editable = open !== null && locked === null;
  const squad = picked.map((id) => byId.get(id)!);
  const errors = squadRuleErrors(squad, captain);
  const left = budgetLeft(squad);
  const slots = fillSlots(squad);
  const empty = openSlots(squad);

  function add(id: number) {
    setPicked([...picked, id]);
    setPicking(null);
  }
  function remove(id: number) {
    setPicked(picked.filter((p) => p !== id));
    if (captain === id) setCaptain(null);
  }

  if (picking) {
    return (
      <Picker
        slot={picking}
        players={players}
        squad={squad}
        pointsRound={pointsRound}
        onPick={add}
        onBack={() => setPicking(null)}
      />
    );
  }

  const fullClubs = [
    ...new Set(
      squad
        .filter((p) => p.teamId !== null && squad.filter((q) => q.teamId === p.teamId).length >= MAX_PER_TEAM)
        .map((p) => p.teamName!.split(" ")[0]),
    ),
  ];
  const missing = SQUAD_SIZE - squad.length;

  return (
    <div className={styles.builder}>
      <section aria-label="Deadline" className={styles.deadline} aria-live="polite">
        {locked ? (
          <p>
            <strong>{locked.name}</strong> locked at {formatDeadline(locked.deadline)}. You can make changes once its
            last game ends.
          </p>
        ) : open ? (
          <p>
            <strong>
              {open.name} locks {formatDeadline(open.deadline)}
            </strong>
            <span className={styles.deadlineHint}>
              Your squad <Countdown deadline={open.deadline} now={now} />. Changes are allowed until the first tip-off.
            </span>
          </p>
        ) : (
          <p>There&apos;s no upcoming round to pick a squad for yet.</p>
        )}
      </section>

      <section aria-label="Squad rules" className={styles.tiles}>
        <div className={styles.tile}>
          <span className={styles.tileLabel}>Budget left</span>
          <span className={`${styles.tileValue} ${left < 0 ? styles.over : ""}`}>
            {credits(left)} <span className={styles.tileOf}>/ {BUDGET}</span>
          </span>
          <span className={styles.bar} aria-hidden="true">
            <span style={{ width: `${Math.min(100, Math.max(0, ((BUDGET - left) / BUDGET) * 100))}%` }} />
          </span>
        </div>
        <div className={styles.tile}>
          <span className={styles.tileLabel}>Players</span>
          <span className={styles.tileValue}>
            {squad.length} / {SQUAD_SIZE}
          </span>
          <span className={styles.tileNote}>
            {missing === 0 ? "Squad full" : empty.FLEX > 0 && missing === 1 ? "Flex spot open" : `${missing} to pick`}
          </span>
        </div>
        <div className={styles.tile}>
          <span className={styles.tileLabel}>Per club</span>
          <span className={styles.tileValue}>Max {MAX_PER_TEAM}</span>
          <span className={styles.tileNote}>{fullClubs.length ? `${fullClubs.join(", ")} full` : "No club full"}</span>
        </div>
      </section>

      <form action={action} className={styles.form}>
        {SLOT_ORDER.map((slot) => (
          <section key={slot} aria-labelledby={`slot-${slot}`} className={styles.group}>
            <div className={styles.groupHead}>
              <h2 id={`slot-${slot}`}>{SLOT_LABELS[slot].group}</h2>
              <span>{slot === "FLEX" ? "Any position" : `${slots[slot].length + empty[slot]} needed`}</span>
            </div>
            <ul className={styles.slots}>
              {slots[slot].map((p) => (
                <li key={p.id} className={styles.player}>
                  <ClubBadge player={p} />
                  <span className={styles.who}>
                    <span className={styles.name}>
                      {p.name}
                      {captain === p.id && (
                        <span className={styles.captainBadge} aria-label="captain">
                          C
                        </span>
                      )}
                    </span>
                    <span className={styles.sub}>
                      {p.teamName ?? "No team"}
                      {slot === "FLEX" && ` · ${p.position ? POSITION_NAMES[p.position] : "No position"}`}
                    </span>
                  </span>
                  <span className={styles.price}>
                    {p.price === null ? "–" : credits(p.price)}
                    <span className={styles.sub}>{points(p.roundPoints)} pts</span>
                  </span>
                  {editable && (
                    <span className={styles.controls}>
                      <button
                        type="button"
                        className={styles.captainToggle}
                        aria-pressed={captain === p.id}
                        onClick={() => setCaptain(p.id)}
                      >
                        C<span className="sr-only"> Make {p.name} captain</span>
                      </button>
                      <button type="button" className={styles.remove} onClick={() => remove(p.id)}>
                        <span aria-hidden="true">×</span>
                        <span className="sr-only">Remove {p.name}</span>
                      </button>
                    </span>
                  )}
                </li>
              ))}
              {Array.from({ length: empty[slot] }, (_, i) => (
                <li key={`empty-${i}`}>
                  <button
                    type="button"
                    className={styles.emptySlot}
                    onClick={() => setPicking(slot)}
                    disabled={!editable}
                  >
                    <span className={styles.plus} aria-hidden="true">
                      +
                    </span>
                    <span>
                      <span className={styles.name}>{ADD_LABEL[slot]}</span>
                      <span className={styles.sub}>
                        {SLOT_LABELS[slot].accepts} · up to {credits(Math.max(0, left))} cr
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}

        {squad.length > 0 && editable && (
          <p className={styles.hint}>Tap C to choose your captain. Their points count double.</p>
        )}
        {editable && missing === 0 && errors.length > 0 && (
          <ul className={styles.rules} aria-label="Still to fix">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}

        <input type="hidden" name="players" value={picked.join(",")} />
        <input type="hidden" name="captain" value={captain ?? ""} />
        {editable && (
          <button className={styles.save} type="submit" disabled={pending || errors.length > 0}>
            {pending
              ? "Saving…"
              : missing > 0
                ? `Pick ${missing} more to save`
                : errors.length > 0
                  ? "Fix the squad to save"
                  : "Save squad"}
          </button>
        )}
        {state.errors.length > 0 && (
          <div className={styles.error} role="alert">
            <p>Your squad wasn&apos;t saved:</p>
            <ul>
              {state.errors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </div>
        )}
        {state.savedAt && state.errors.length === 0 && (
          <p className={styles.success} role="status">
            Squad saved.
          </p>
        )}
      </form>
      {state.offerReminders && props.vapidPublicKey && <ReminderCard vapidPublicKey={props.vapidPublicKey} />}
    </div>
  );
}

const FILTERS: { label: string; slot: Slot }[] = [
  { label: "All", slot: "FLEX" },
  { label: "Guards", slot: "G" },
  { label: "Forwards", slot: "F" },
  { label: "Centres", slot: "C" },
];

/** Players who can fill one slot. Ones who can't be added right now stay listed, dimmed, with the reason. */
export function Picker({
  slot,
  players,
  squad,
  pointsRound,
  onPick,
  onBack,
}: {
  slot: Slot;
  players: PlayerListing[];
  squad: PlayerListing[];
  pointsRound: string | null;
  onPick: (id: number) => void;
  onBack: () => void;
}) {
  const [search, setSearch] = useState("");
  /** Flex takes anyone, so it can be narrowed to one position. */
  const [filter, setFilter] = useState<Slot>("FLEX");
  const left = budgetLeft(squad);
  const term = search.trim().toLowerCase();
  const shown = players
    .filter((p) => fits(p, slot) && fits(p, filter))
    .filter((p) => !term || p.name.toLowerCase().includes(term) || (p.teamName ?? "").toLowerCase().includes(term))
    .map((p) => ({ player: p, problem: pickProblem(p, squad) }))
    .sort(
      (a, b) =>
        Number(a.problem !== null) - Number(b.problem !== null) ||
        (b.player.roundPoints ?? -1) - (a.player.roundPoints ?? -1) ||
        a.player.name.localeCompare(b.player.name, "en-IE"),
    );

  return (
    <div className={styles.picker}>
      <header className={styles.pickerHead}>
        <button type="button" className={styles.back} onClick={onBack}>
          <span aria-hidden="true">‹</span>
          <span className="sr-only">Back to squad</span>
        </button>
        <div>
          <h2>Pick your {slot === "FLEX" ? "flex player" : POSITION_NAMES[slot].toLowerCase()}</h2>
          <p className={styles.sub}>
            {SLOT_LABELS[slot].accepts} · up to {credits(Math.max(0, left))} cr
          </p>
        </div>
      </header>

      <label className={styles.search}>
        <span className="sr-only">Search players</span>
        <input
          type="search"
          placeholder="Search name or club"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>

      {slot === "FLEX" && (
        <div role="group" aria-label="Position" className={styles.filters}>
          {FILTERS.map((f) => (
            <button
              key={f.slot}
              type="button"
              aria-pressed={filter === f.slot}
              className={styles.filter}
              onClick={() => setFilter(f.slot)}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      <p className={styles.listHead}>
        <span>{pointsRound ? `By ${pointsRound} points` : "Players"}</span>
        <span>Price</span>
      </p>
      <ul className={styles.slots} aria-label="Players">
        {shown.map(({ player: p, problem }) => (
          <li key={p.id} className={`${styles.player} ${problem ? styles.blocked : ""}`}>
            <ClubBadge player={p} />
            <span className={styles.who}>
              <span className={styles.name}>
                {p.name}
                <span className={styles.pos}>{p.position ?? "–"}</span>
              </span>
              <span className={problem ? styles.reason : styles.sub}>
                {problem ?? `${points(p.roundPoints)} pts${pointsRound ? ` in ${pointsRound}` : ""}`}
              </span>
            </span>
            <span className={styles.price}>{p.price === null ? "–" : credits(p.price)}</span>
            {problem ? (
              <span className={styles.addSpacer} aria-hidden="true" />
            ) : (
              <button type="button" className={styles.add} onClick={() => onPick(p.id)}>
                <span aria-hidden="true">+</span>
                <span className="sr-only">Add {p.name}</span>
              </button>
            )}
          </li>
        ))}
      </ul>
      {shown.length === 0 && <p className="muted">No players match.</p>}

      <footer className={styles.spend}>
        <span>
          <span className={styles.tileLabel}>You can spend</span>
          <span className={styles.spendValue}>{credits(Math.max(0, left))} cr</span>
        </span>
        <span className={styles.sub}>
          Squad {squad.length} / {SQUAD_SIZE}
          <br />
          Max {MAX_PER_TEAM} per club
        </span>
      </footer>
    </div>
  );
}
