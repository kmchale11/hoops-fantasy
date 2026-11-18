import { timingSafeEqual } from "node:crypto";

/**
 * True when the request carries `Authorization: Bearer <secret>`.
 * An unset secret never matches, so a missing env var locks the endpoint rather than opening it.
 */
export function hasBearerSecret(request: Request, secret: string | undefined): boolean {
  if (!secret) return false;
  const header = request.headers.get("authorization") ?? "";
  const match = /^Bearer (.+)$/.exec(header);
  if (!match) return false;
  const given = Buffer.from(match[1]);
  const expected = Buffer.from(secret);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export const unauthorized = () => Response.json({ error: "Unauthorized" }, { status: 401 });
