import { ClaimForm } from "@/components/ClaimForm";

export const metadata = {
  title: "Submit a claim · Lemma",
  description:
    "Submit a claim for verification by a jury of GenLayer validators.",
};

export default function SubmitPage() {
  return (
    <div className="space-y-section">
      <header className="max-w-prose">
        <p className="editorial-label">A submission to the court</p>
        <h1 className="mt-4 font-serif text-h1 leading-tight text-ink">
          Submit a claim for verification.
        </h1>
        <p className="mt-4 font-serif text-lead italic leading-relaxed text-ink-soft">
          Compose your claim as a self-contained statement, cite the source,
          and stake conviction. The jury will deliberate on whether the source
          supports what the claim asserts.
        </p>
      </header>

      <hr className="hairline" />

      <ClaimForm />
    </div>
  );
}
