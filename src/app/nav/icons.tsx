import type { NavIcon } from "./items";

/** Stroke icons from the design canvas, drawn in the text colour. */
const PATHS: Record<NavIcon, React.ReactNode> = {
  squad: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20a6.5 6.5 0 0 1 13 0" />
      <circle cx="17" cy="9" r="2.5" />
      <path d="M17 14.5a5 5 0 0 1 4.5 5" />
    </>
  ),
  results: <path d="M5 20V11M12 20V4M19 20v-6" />,
  leagues: (
    <>
      <path d="M8 21h8M12 17v4" />
      <path d="M7 4h10v5a5 5 0 0 1-10 0z" />
      <path d="M17 6h3a3 3 0 0 1-3 4M7 6H4a3 3 0 0 0 3 4" />
    </>
  ),
  leaderboard: <path d="M3 21h18M9 21V9h6v12M3 21v-7h6M15 21v-4h6v4" />,
  more: <path d="M4 7h16M4 12h16M4 17h16" />,
  home: <path d="M3 11 12 4l9 7M5 10v10h5v-6h4v6h5V10" />,
  guide: <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2zM4 21V5M8 7h7M8 11h7" />,
  "sign-in": <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M10 16l4-4-4-4M14 12H3" />,
  admin: <path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z" />,
};

export function Icon({ name, size = 22 }: { name: NavIcon; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}
