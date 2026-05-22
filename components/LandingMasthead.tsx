import { LogoLockup } from "./LogoLockup";

/**
 * LandingMasthead
 *
 * The journal-style masthead block that sits below the Topbar on the
 * landing page only. Split layout: large logo lockup on the left,
 * italic tagline on the right, dateline above, double-rule below.
 *
 * The date string is computed at request time from the server so the
 * masthead always reads as "today's edition" without needing client
 * JavaScript or revalidation tags.
 */

interface LandingMastheadProps {
  date?: Date;
}

function formatDateline(d: Date): string {
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function LandingMasthead({ date }: LandingMastheadProps) {
  const dateline = formatDateline(date ?? new Date());

  return (
    <section className="masthead" style={{ paddingTop: "3.5rem" }}>
      {/* Dateline ---------------------------------------------------- */}
      <div
        className="dateline caps-sm flex"
        style={{
          justifyContent: "space-between",
          color: "var(--lemma-ink-muted)",
          paddingBottom: "0.75rem",
          borderBottom: "1px solid var(--lemma-divider)",
          gap: "1rem",
        }}
      >
        <span>Vol. I &middot; Issue 1</span>
        <span>ISSN 2026-LEMM &middot; Bradbury Testnet</span>
        <span>{dateline}</span>
      </div>

      {/* Title row --------------------------------------------------- */}
      <div
        className="masthead-title grid items-end"
        style={{
          gridTemplateColumns: "1fr auto",
          gap: "2rem",
          padding: "1.4rem 0 1rem",
        }}
      >
        <div style={{ textAlign: "left" }}>
          <LogoLockup size="lg" />
        </div>
        <p
          className="font-serif italic"
          style={{
            textAlign: "right",
            margin: 0,
            padding: 0,
            maxWidth: "24ch",
            fontSize: "1.05rem",
            lineHeight: 1.45,
            color: "var(--lemma-ink-soft)",
          }}
        >
          A standing court
          <br />
          for the scientific record
        </p>
      </div>

      {/* Double rule ------------------------------------------------- */}
      <hr className="double-rule" />
    </section>
  );
}
