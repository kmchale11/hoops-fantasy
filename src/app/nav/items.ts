export type NavIcon = "squad" | "results" | "leagues" | "leaderboard" | "more" | "home" | "guide" | "sign-in" | "admin";

export interface NavItem {
  href: string;
  label: string;
  icon: NavIcon;
  /** Paths that count as this section, so it's highlighted on their pages too. */
  matches: string[];
  /** Only in the top bar on wider screens; phones reach it through More. */
  wideOnly?: boolean;
}

export type NavVariant = "signed-out" | "player" | "admin";

const PLAYER: NavItem[] = [
  { href: "/squad", label: "Squad", icon: "squad", matches: ["/squad", "/welcome"] },
  { href: "/results", label: "Results", icon: "results", matches: ["/results"] },
  { href: "/leagues", label: "Leagues", icon: "leagues", matches: ["/leagues", "/join"] },
  { href: "/leaderboard", label: "Leaderboard", icon: "leaderboard", matches: ["/leaderboard"] },
  {
    href: "/more",
    label: "More",
    icon: "more",
    matches: ["/more", "/how-to-play", "/scoring", "/account", "/privacy", "/terms", "/admin"],
  },
];

const ADMIN: NavItem = { href: "/admin", label: "Admin", icon: "admin", matches: ["/admin"], wideOnly: true };

const SIGNED_OUT: NavItem[] = [
  { href: "/", label: "Home", icon: "home", matches: ["/"] },
  { href: "/how-to-play", label: "How to play", icon: "guide", matches: ["/how-to-play", "/scoring"] },
  { href: "/sign-in", label: "Sign in", icon: "sign-in", matches: ["/sign-in", "/auth"] },
];

/** The menu for each kind of visitor. Admins see the player menu plus Admin in the top bar. */
export function navItems(variant: NavVariant): NavItem[] {
  if (variant === "signed-out") return SIGNED_OUT;
  if (variant === "admin") return [...PLAYER, ADMIN];
  return PLAYER;
}

/** The item for the current page: the most specific match, so /admin beats More's "/admin". */
export function currentItem(items: NavItem[], pathname: string): NavItem | null {
  let best: { item: NavItem; length: number } | null = null;
  for (const item of items) {
    for (const m of item.matches) {
      const hit = m === "/" ? pathname === "/" : pathname === m || pathname.startsWith(`${m}/`);
      if (hit && (!best || m.length > best.length || (m.length === best.length && item.wideOnly))) {
        best = { item, length: m.length };
      }
    }
  }
  return best?.item ?? null;
}
