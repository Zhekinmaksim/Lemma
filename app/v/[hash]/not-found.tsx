import Link from "next/link";

export default function VerdictNotFound() {
  return (
    <article className="mx-auto max-w-prose">
      <p className="editorial-label">No verdict on file</p>
      <h1 className="mt-4 font-serif text-h1 leading-tight text-ink">
        The court has no record of this hash.
      </h1>
      <p className="mt-6 font-serif text-lead leading-relaxed text-ink-soft">
        Either the claim has not yet been submitted, or the hash you arrived
        with is malformed. You can submit a new claim, or return to the docket
        and browse recent verdicts.
      </p>
      <div className="mt-8 flex gap-6">
        <Link href="/" className="btn">
          Return to the docket
        </Link>
        <Link href="/submit" className="btn btn-primary">
          Submit a claim →
        </Link>
      </div>
    </article>
  );
}
