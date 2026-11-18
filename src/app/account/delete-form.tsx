"use client";

import { useActionState } from "react";
import styles from "@/app/forms.module.css";
import { deleteAccount, type DeleteState } from "./actions";

export default function DeleteForm() {
  const [state, action, pending] = useActionState<DeleteState, FormData>(deleteAccount, {});
  return (
    <form className={styles.card} action={action}>
      <p>
        This permanently deletes your account, your team and your place in every league. It can&apos;t be
        undone.
      </p>
      <label className={styles.check}>
        <input type="checkbox" name="confirm" />
        <span>I understand. Delete my account.</span>
      </label>
      <button className={styles.danger} type="submit" disabled={pending}>
        {pending ? "Deleting…" : "Delete my account"}
      </button>
      {state.error && (
        <p className={styles.error} role="alert">
          {state.error}
        </p>
      )}
    </form>
  );
}
