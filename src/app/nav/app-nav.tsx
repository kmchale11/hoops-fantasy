import { getAccount } from "@/lib/session";
import { navItems, type NavVariant } from "./items";
import NavLinks from "./nav-links";

/** The menu on every page: tabs at the bottom on phones, links across the top on wider screens. */
export default async function AppNav() {
  const account = await getAccount();
  const variant: NavVariant =
    account.status === "signed-out" ? "signed-out" : account.status === "ready" && account.profile.isAdmin ? "admin" : "player";
  return <NavLinks items={navItems(variant)} />;
}
