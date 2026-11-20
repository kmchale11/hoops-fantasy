"use client";

import { useActionState, useState } from "react";
import styles from "@/app/forms.module.css";
import { POSITION_NAMES, type Position } from "@/squads/rules";
import { importPrices, savePrices, type PriceEditState, type PriceImportState } from "./actions";
import local from "./prices.module.css";

export interface PriceRow {
  id: number;
  name: string;
  team: string | null;
  price: number | null;
  position: Position | null;
}

export function PriceEditor({ players }: { players: PriceRow[] }) {
  const initial: PriceEditState = { errors: {}, message: null, saved: null };
  const [state, action, pending] = useActionState(savePrices, initial);

  return (
    <form className={styles.card} action={action}>
      <table className={local.table}>
        <thead>
          <tr>
            <th scope="col">Player</th>
            <th scope="col">Team</th>
            <th scope="col">Position</th>
            <th scope="col">Price</th>
          </tr>
        </thead>
        <tbody>
          {players.map((p) => (
            <tr key={p.id}>
              <th scope="row">
                <label htmlFor={`price-${p.id}`}>{p.name}</label>
              </th>
              <td>{p.team ?? "No team"}</td>
              <td>
                <select
                  name={`position-${p.id}`}
                  aria-label={`${p.name}'s position`}
                  className={styles.input}
                  defaultValue={p.position ?? ""}
                >
                  <option value="">Not set</option>
                  {Object.entries(POSITION_NAMES).map(([code, name]) => (
                    <option key={code} value={code}>
                      {name}
                    </option>
                  ))}
                </select>
                {p.position === null && <p className={local.flag}>Needs a position</p>}
              </td>
              <td>
                <input
                  id={`price-${p.id}`}
                  name={`price-${p.id}`}
                  className={`${styles.input} ${local.price}`}
                  inputMode="decimal"
                  placeholder="Unpriced"
                  defaultValue={p.price === null ? "" : p.price.toFixed(1)}
                  aria-invalid={Boolean(state.errors[p.id])}
                />
                {state.errors[p.id] && <p className={styles.fieldError}>{state.errors[p.id]}</p>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className={styles.hint}>
        Prices 4.0–15.0 in steps of 0.5; leave blank to make a player unavailable. A player with no position
        can only be picked for the flex slot.
      </p>
      <button className={styles.button} type="submit" disabled={pending}>
        {pending ? "Saving…" : "Save prices and positions"}
      </button>
      {state.message && <p className={styles.error}>{state.message}</p>}
      {state.saved !== null && <p className={styles.success}>Saved.</p>}
    </form>
  );
}

const TEMPLATE = "player_name,team,price\n\"Seán Murphy\",Ballina Braves,8.5\n";

export function PriceImport() {
  const initial: PriceImportState = { errors: [], message: null, updated: null };
  const [state, action, pending] = useActionState(importPrices, initial);
  const [csv, setCsv] = useState("");

  return (
    <form className={styles.card} action={action}>
      <label className={styles.label} htmlFor="price-file">
        CSV file
      </label>
      <input
        id="price-file"
        className={styles.input}
        type="file"
        accept=".csv,text/csv"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (file) setCsv(await file.text());
        }}
      />
      <label className={styles.label} htmlFor="price-csv">
        Or paste it
      </label>
      <textarea
        id="price-csv"
        name="csv"
        className={`${styles.input} ${styles.textarea}`}
        placeholder={TEMPLATE}
        value={csv}
        onChange={(e) => setCsv(e.target.value)}
        spellCheck={false}
      />
      <p className={styles.hint}>
        Columns: price, plus player_name and team (name or short name), or player_external_id.
      </p>
      <button className={styles.button} type="submit" disabled={pending || !csv.trim()}>
        {pending ? "Importing…" : "Import prices"}
      </button>
      {state.updated !== null && <p className={styles.success}>Set {state.updated} prices.</p>}
      {state.message && (
        <div className={styles.error}>
          <p>{state.message}</p>
          <ul>
            {state.errors.map((err, i) => (
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
