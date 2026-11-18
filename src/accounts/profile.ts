import type { Db } from "@/lib/db";

export const NAME_MIN_LENGTH = 3;
export const NAME_MAX_LENGTH = 30;

export interface Profile {
  userId: string;
  managerName: string;
  teamName: string;
  ageConfirmedAt: Date;
  termsAcceptedAt: Date;
  isAdmin: boolean;
}

export interface SignUpInput {
  managerName: string;
  teamName: string;
  ageConfirmed: boolean;
  termsAccepted: boolean;
}

export type SignUpField = keyof SignUpInput;
export type SignUpErrors = Partial<Record<SignUpField, string>>;
export type SignUpResult = { ok: true; profile: Profile } | { ok: false; errors: SignUpErrors };

/** Trims and collapses runs of whitespace, so "  Moy   Valley " and "Moy Valley" are the same name. */
export function normaliseName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

/** Length in characters as Postgres counts them (so "Seán" is 4, and emoji count once). */
const charLength = (s: string) => Array.from(s).length;

function nameProblem(label: string, name: string): string | undefined {
  const length = charLength(name);
  if (length < NAME_MIN_LENGTH || length > NAME_MAX_LENGTH) {
    return `${label} must be ${NAME_MIN_LENGTH}–${NAME_MAX_LENGTH} characters`;
  }
}

export function validateSignUp(input: SignUpInput): SignUpErrors {
  const errors: SignUpErrors = {};
  const manager = nameProblem("Manager name", normaliseName(input.managerName));
  const team = nameProblem("Team name", normaliseName(input.teamName));
  if (manager) errors.managerName = manager;
  if (team) errors.teamName = team;
  if (!input.ageConfirmed) errors.ageConfirmed = "You must be 18 or over to play";
  if (!input.termsAccepted) errors.termsAccepted = "You need to accept the terms to play";
  return errors;
}

const PROFILE_COLUMNS = `user_id as "userId", manager_name as "managerName", team_name as "teamName",
  age_confirmed_at as "ageConfirmedAt", terms_accepted_at as "termsAcceptedAt", is_admin as "isAdmin"`;

export async function getProfile(db: Db, userId: string): Promise<Profile | null> {
  const [profile] = await db.query<Profile>(`select ${PROFILE_COLUMNS} from profiles where user_id = $1`, [userId]);
  return profile ?? null;
}

/**
 * Finishes sign-up: records the user's names and the time they confirmed their age and
 * accepted the terms. Nothing is saved unless every field is valid.
 */
export async function createProfile(db: Db, userId: string, input: SignUpInput, now: Date): Promise<SignUpResult> {
  const errors = validateSignUp(input);
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  try {
    const [profile] = await db.query<Profile>(
      `insert into profiles (user_id, manager_name, team_name, age_confirmed_at, terms_accepted_at)
       values ($1, $2, $3, $4, $4)
       returning ${PROFILE_COLUMNS}`,
      [userId, normaliseName(input.managerName), normaliseName(input.teamName), now],
    );
    return { ok: true, profile };
  } catch (error) {
    if (isUniqueViolation(error, "profiles_team_name_unique")) {
      return { ok: false, errors: { teamName: "That team name is taken" } };
    }
    if (isUniqueViolation(error, "profiles_pkey")) {
      return { ok: false, errors: { managerName: "You've already finished signing up" } };
    }
    throw error;
  }
}

function isUniqueViolation(error: unknown, constraint: string): boolean {
  if (typeof error !== "object" || error === null) return false;
  const e = error as { code?: string; constraint?: string; message?: string };
  return e.code === "23505" && (e.constraint === constraint || (e.message ?? "").includes(constraint));
}
