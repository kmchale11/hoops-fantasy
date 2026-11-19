import { redirect } from "next/navigation";

export const instant = false;

/** Short invite links (/join/ABC234), which open the app when it's installed. */
export default async function JoinLink({ params }: PageProps<"/join/[code]">) {
  const { code } = await params;
  redirect(`/leagues/join?code=${encodeURIComponent(code.slice(0, 12))}`);
}
