"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_NAME } from "@/lib/app-identity";
import { Icon } from "./icons";
import { currentItem, type NavItem } from "./items";
import styles from "./nav.module.css";

/** The menu's links, with the current section marked for screen readers and highlighted. */
export default function NavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const current = currentItem(items, pathname ?? "");
  return (
    <nav aria-label="Main" className={styles.nav} data-current={current?.icon}>
      <Link href={items[0].href} className={styles.brand}>
        {APP_NAME}
      </Link>
      <ul className={styles.list} style={{ "--tabs": items.filter((i) => !i.wideOnly).length } as React.CSSProperties}>
        {items.map((item) => (
          <li key={item.href} className={item.wideOnly ? styles.wideOnly : undefined}>
            <Link
              href={item.href}
              className={`${styles.link} ${styles[item.icon] ?? ""}`}
              aria-current={item === current ? "page" : undefined}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Holds the menu's place while the session is checked, so the page doesn't jump. */
export function NavPlaceholder() {
  return <div className={styles.nav} aria-hidden="true" />;
}
