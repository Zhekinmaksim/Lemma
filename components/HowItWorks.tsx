/**
 * HowItWorks
 *
 * Three numbered editorial columns describing the lifecycle of a claim:
 * filing, jury deliberation, verdict. Collapses to a single column on
 * narrow viewports per the design handoff (<= 720px).
 *
 * The section numerals are typeset like a printed lemma's preamble:
 * mono caps, rust, with a §-marker that signals "section" without
 * resorting to ornamentation that would clash with the journal voice.
 */

interface Step {
  numeral: string;
  heading: string;
  body: React.ReactNode;
}

const STEPS: Step[] = [
  {
    numeral: "§ I.",
    heading: "A citation is staked",
    body: (
      <>
        An author files the cited sentence together with its source - an arXiv
        preprint, a journal article, a dataset. A{" "}
        <span className="mono">0.001 GEN</span> stake accompanies the filing.
      </>
    ),
  },
  {
    numeral: "§ II.",
    heading: "The jury reads the paper",
    body: (
      <>
        Five independent validators fetch the cited manuscript, read it under
        the equivalence principle, and reach consensus on whether the citing
        sentence is faithful to its source.
      </>
    ),
  },
  {
    numeral: "§ III.",
    heading: "The verdict enters the record",
    body: (
      <>
        A permanent verdict - <em>verified</em>, <em>partially verified</em>,{" "}
        <em>misrepresented</em>, <em>unsupported</em>, or <em>unverifiable</em>{" "}
        - is written to chain. Authors may cite it; reviewers may appeal it.
      </>
    ),
  },
];

export function HowItWorks() {
  return (
    <section
      id="methodology"
      className="how grid"
      style={{
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: "2.5rem 3rem",
        padding: "4rem 0 3rem",
        borderTop: "1px solid var(--lemma-divider)",
        marginTop: "4rem",
      }}
    >
      {STEPS.map((s) => (
        <article key={s.numeral} className="step">
          <span
            className="font-mono uppercase block"
            style={{
              fontSize: "0.72rem",
              letterSpacing: "0.14em",
              color: "var(--lemma-rust)",
              marginBottom: "0.5rem",
            }}
          >
            {s.numeral}
          </span>
          <h3
            className="font-serif"
            style={{
              fontWeight: 500,
              fontSize: "1.25rem",
              margin: "0 0 0.5rem",
              lineHeight: 1.2,
              color: "var(--lemma-ink)",
            }}
          >
            {s.heading}
          </h3>
          <p
            className="font-serif"
            style={{
              fontSize: "0.96rem",
              color: "var(--lemma-ink-soft)",
              margin: 0,
              lineHeight: 1.55,
            }}
          >
            {s.body}
          </p>
        </article>
      ))}
    </section>
  );
}
