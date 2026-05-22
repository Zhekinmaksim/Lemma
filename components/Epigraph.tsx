/**
 * Epigraph
 *
 * A pulled-quote framing block beneath the masthead. The 2px rust left
 * border signals the editorial register. Body italic emphasises the
 * publication name and a phrase from the citing sentence's
 * description, lifted in tonal weight rather than colour.
 */
export function Epigraph() {
  return (
    <section
      style={{
        maxWidth: "56ch",
        margin: "3rem auto 0",
        padding: "0 0 0 1.5rem",
        borderLeft: "2px solid var(--lemma-rust)",
      }}
    >
      <p
        className="font-serif"
        style={{
          fontSize: "1.05rem",
          lineHeight: 1.6,
          color: "var(--lemma-ink-soft)",
          margin: 0,
          textWrap: "pretty",
        }}
      >
        The replication crisis is also a citation crisis. A 2024 meta-study in{" "}
        <em style={{ color: "var(--lemma-ink)" }}>Nature</em> found that roughly
        two in three published papers contain at least one citation whose source
        does not say what the citing sentence claims it does. Lemma is a register
        of record for that problem - a standing court that{" "}
        <em style={{ color: "var(--lemma-ink)" }}>reads the paper</em> before
        the citation is filed.
      </p>
      <p
        className="caps-sm"
        style={{
          fontSize: "0.72rem",
          letterSpacing: "0.14em",
          color: "var(--lemma-ink-muted)",
          margin: "0.7rem 0 0",
        }}
      >
        - From the editors
      </p>
    </section>
  );
}
