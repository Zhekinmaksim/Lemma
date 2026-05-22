export const metadata = {
  title: "About · Lemma",
  description:
    "How the Lemma citation court works, why it matters, and how to appeal a verdict.",
};

/**
 * A scholarly essay, not a marketing page.
 *
 * Written in the tone of an editor's note in a journal. The drop cap
 * on the first paragraph, the hairline dividers between sections, and
 * the marginalia on the right column carry the editorial signal.
 */
export default function AboutPage() {
  return (
    <article className="mx-auto max-w-prose space-y-section">
      <header>
        <p className="editorial-label">Editor&rsquo;s note</p>
        <h1 className="mt-4 font-serif text-h1 leading-tight text-ink">
          On the necessity of an on-chain citation court.
        </h1>
      </header>

      <hr className="hairline" />

      <section>
        <p className="font-serif text-lead leading-relaxed text-ink drop-cap">
          A citation is a promise: the writer asserts that some other text
          contains the evidence for what is being claimed. In the era of agent-
          written research, that promise is broken at scale. Models invent
          references, misremember findings, and paraphrase past the point of
          accuracy. The fix is not to ban automation but to verify it.
        </p>

        <p className="mt-6 font-serif text-body leading-relaxed text-ink">
          Lemma is a citation court that lives on the GenLayer Bradbury
          Testnet. When a claim is submitted, a randomly selected jury of
          validators fetches the cited source, reads it, and reaches consensus
          on whether the claim is faithfully supported. The verdict is
          published on-chain with a permanent reference.
        </p>
      </section>

      <hr className="hairline" />

      <Section title="Why an intelligent contract">
        <p>
          Traditional smart contracts can verify hashes, transfers, and
          deterministic state. They cannot read an article and decide whether
          it supports a claim - that requires subjective judgment over
          unstructured text. GenLayer&rsquo;s equivalence principle solves the
          consensus problem: validators do not need to produce identical
          strings, they need to agree on a discrete verdict label. The label
          is the contract; the prose justifications may differ.
        </p>
      </Section>

      <Section title="The five labels">
        <p>
          A verdict is one of five labels. They are not graded on a numeric
          scale because such grading invites false precision; ordinal labels
          force the jury to commit.
        </p>
        <ul className="mt-4 space-y-3 font-serif text-body leading-relaxed text-ink">
          <li>
            <strong className="font-medium">Verified.</strong> The source
            clearly supports the claim as stated.
          </li>
          <li>
            <strong className="font-medium">Partially verified.</strong> The
            source supports parts of the claim but with caveats the claim
            omits.
          </li>
          <li>
            <strong className="font-medium text-rust-deep">
              Misrepresented.
            </strong>{" "}
            The source contradicts the claim or distorts what the source
            actually said.
          </li>
          <li>
            <strong className="font-medium">Unsupported.</strong> The source
            does not address the claim at all.
          </li>
          <li>
            <strong className="font-medium">Unverifiable.</strong> The source
            is inaccessible, paywalled, empty, or too short to judge.
          </li>
        </ul>
      </Section>

      <Section title="The appeal procedure">
        <p>
          A verdict may be appealed exactly once. The appellant stakes five
          times the original stake; the jury re-deliberates under a stricter
          prompt that requires the justifications to reference specific
          elements of the source. If the label flips, the dashboard counters
          are rebalanced. If the label stands, the appeal stake is forfeited.
        </p>
      </Section>

      <Section title="Known limits of v1">
        <p>
          The jury reads only the first twelve thousand characters of the
          source. Pages that hide their evidence past that cutoff will
          sometimes return <em>unsupported</em>. Pages rendered entirely in
          client-side JavaScript will frequently return <em>unverifiable</em>.
          The court does not yet adjudicate claims against PDFs, video, or
          audio sources. These limits will be addressed in future versions
          and are tracked in the open repository.
        </p>
      </Section>

      <Section title="Open source">
        <p>
          Lemma is open source. The intelligent contract, the frontend, and
          the OG image generator are all in one repository, with deployment
          instructions for both GenLayer Studio and Bradbury. Pull requests
          for new languages, new source-fetching modes, and improved jury
          prompts are welcome.
        </p>
        <p className="mt-4">
          <a
            href={process.env.NEXT_PUBLIC_REPO_URL ?? "https://github.com/Zhekinmaksim/lemma"}
            className="editorial-link"
            target="_blank"
            rel="noreferrer noopener"
          >
            github.com/Zhekinmaksim/lemma →
          </a>
        </p>
      </Section>
    </article>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="font-serif text-h2 text-ink">{title}</h2>
      <div className="mt-4 space-y-4 font-serif text-body leading-relaxed text-ink">
        {children}
      </div>
    </section>
  );
}
