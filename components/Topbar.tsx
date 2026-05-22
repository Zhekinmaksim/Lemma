import Link from "next/link";
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
  return (
    <header className="topbar flex items-baseline justify-between border-b border-divider pb-[1.1rem]">
      <Link
        href="/"
        className="wm"
        aria-label="Lemma - home"
        style={{ alignSelf: "center" }}
      >
        <LogoLockup size="sm" />
      </Link>

      <nav className="topbar-nav flex items-baseline">
        <Link
          href="/submit"
          className="font-mono uppercase"
          style={{
            fontSize: "0.72rem",
            letterSpacing: "0.14em",
            color: "var(--lemma-ink-soft)",
          }}
        >
          submit
        </Link>
        <Link
          href="/about"
          className="font-mono uppercase"
          style={{
            fontSize: "0.72rem",
            letterSpacing: "0.14em",
            color: "var(--lemma-ink-soft)",
          }}
        >
          methodology
        </Link>
        <Link
          href="/dashboard"
          className="font-mono uppercase"
          style={{
            fontSize: "0.72rem",
            letterSpacing: "0.14em",
            color: "var(--lemma-ink-soft)",
          }}
        >
          recent
        </Link>
        <WalletConnect />
      </nav>
    </header>
  );
}
