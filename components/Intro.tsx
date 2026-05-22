import Link from "next/link";

/**
 * Intro
 *
 * The lede paragraph with a rust drop cap on the leading "A". The full
 * sentence runs at 1.32rem on cream, max-width 50ch. Beneath it, a
 * divider rule and a closing row: italic two-line note on the left,
 * primary CTA on the right.
 *
 * The handoff specifies very precise drop-cap metrics; we apply them
 * via the .dropcap class in globals.css using ::first-letter. The
 * leading "A" is naturally the first letter of the paragraph, so no
 * span tagging is needed.
 */
export function Intro() {
  return (
    <section style={{ padding: "3rem 0 1rem", textAlign: "left" }}>
      <p
        className="font-serif dropcap"
        style={{
          textAlign: "left",
          maxWidth: "50ch",
          fontSize: "1.32rem",
          lineHeight: 1.55,
          margin: 0,
        }}
      >
        A submitted claim receives a verdict from a jury of independent
        validators who fetch the cited source,{" "}
        <em style={{ color: "var(--lemma-rust-deep)" }}>read it</em>, and reach
        consensus on whether the claim is faithfully supported by the page it
        points to.
      </p>

      <div
        className="flex items-baseline"
        style={{
          marginTop: "2.4rem",
          paddingTop: "1.4rem",
          borderTop: "1px solid var(--lemma-divider)",
          justifyContent: "space-between",
          gap: "2rem",
          maxWidth: "50ch",
        }}
      >
        <p
          className="font-serif italic"
          style={{
            margin: 0,
            color: "var(--lemma-ink-soft)",
            textAlign: "left",
            fontSize: "1rem",
            lineHeight: 1.45,
          }}
        >
          Verdicts are permanent.
          <br />
          Citations are accountable.
        </p>
        <Link href="/submit" className="cta">
          Submit a claim &rarr;
        </Link>
      </div>
    </section>
  );
}
