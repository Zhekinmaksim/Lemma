"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { LogoLockup } from "./LogoLockup";
import { WalletConnect } from "./WalletConnect";

/**
 * Topbar
 *
 * The thin horizontal bar above every page: small seal-and-wordmark on
 * the left, navigation + wallet button on the right, hairline rule below.
 *
 * Per the handoff, on the landing page this also serves as the visual
 * intro to the masthead block below it; on inner pages it carries the
 * brand alone.
 */
export function Topbar() {
  const pathname = usePathname();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  const navItems = [
    { href: "/submit", label: "submit", match: (path: string) => path === "/submit" },
    {
      href: "/about",
      label: "methodology",
      match: (path: string) => path === "/about",
    },
    {
      href: "/dashboard",
      label: "recent",
      match: (path: string) => path === "/dashboard" || path.startsWith("/v/"),
    },
  ];

  function handleNavIntent(href: string) {
    if (href === pathname) return;
    setPendingHref(href);
    window.dispatchEvent(
      new CustomEvent("lemma:route-start", {
        detail: { href },
      }),
    );
  }

  return (
    <header className="topbar flex items-baseline justify-between border-b border-divider pb-[1.1rem]">
      <Link
        href="/"
        className="topbar-brand wm"
        aria-label="Lemma - home"
        onClick={() => handleNavIntent("/")}
      >
        <LogoLockup size="sm" />
      </Link>

      <nav className="topbar-nav flex items-baseline">
        {navItems.map((item) => {
          const active = item.match(pathname);
          const pending = pendingHref === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`topbar-link ${active ? "active" : ""} ${pending ? "pending" : ""}`}
              aria-current={active ? "page" : undefined}
              onClick={() => handleNavIntent(item.href)}
            >
              {item.label}
            </Link>
          );
        })}
        <WalletConnect />
      </nav>
    </header>
  );
}
