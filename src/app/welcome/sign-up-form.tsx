"use client";

import Link from "next/link";
import { useActionState } from "react";
import { NAME_MAX_LENGTH, NAME_MIN_LENGTH } from "@/accounts/profile";
import styles from "@/app/forms.module.css";
import { completeSignUp, type SignUpState } from "./actions";

const initial: SignUpState = { errors: {}, values: { managerName: "", teamName: "" } };

export default function SignUpForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(completeSignUp, initial);
  const { errors, values } = state;

  const error = (field: keyof SignUpState["errors"]) =>
    errors[field] && (
      <p className={styles.fieldError} id={`${field}-error`}>
        {errors[field]}
      </p>
    );

  return (
    <form className={styles.card} action={action} noValidate>
      <input type="hidden" name="next" value={next} />

      <label className={styles.label} htmlFor="managerName">
        Manager name
      </label>
      <input
        id="managerName"
        name="managerName"
        className={styles.input}
        autoComplete="nickname"
        minLength={NAME_MIN_LENGTH}
        maxLength={NAME_MAX_LENGTH}
        defaultValue={values.managerName}
        aria-invalid={Boolean(errors.managerName)}
        aria-describedby={errors.managerName ? "managerName-error" : undefined}
      />
      {error("managerName")}

      <label className={styles.label} htmlFor="teamName">
        Team name
      </label>
      <input
        id="teamName"
        name="teamName"
        className={styles.input}
        autoComplete="off"
        minLength={NAME_MIN_LENGTH}
        maxLength={NAME_MAX_LENGTH}
        defaultValue={values.teamName}
        aria-invalid={Boolean(errors.teamName)}
        aria-describedby={errors.teamName ? "teamName-error" : undefined}
      />
      {error("teamName")}
      <p className={styles.hint}>
        Both are shown publicly on leaderboards. {NAME_MIN_LENGTH}–{NAME_MAX_LENGTH} characters.
      </p>

      <label className={styles.check}>
        <input type="checkbox" name="ageConfirmed" />
        <span>I am 18 or over</span>
      </label>
      {error("ageConfirmed")}

      <label className={styles.check}>
        <input type="checkbox" name="termsAccepted" />
        <span>
          I accept the <Link href="/terms">terms</Link>
        </span>
      </label>
      {error("termsAccepted")}

      <button className={styles.button} type="submit" disabled={pending}>
        {pending ? "Saving…" : "Start playing"}
      </button>
    </form>
  );
}
