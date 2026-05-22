import { notFound } from "next/navigation";
import { Suspense } from "react";
import type { Metadata } from "next";
import { fetchVerdictRecord, isContractConfigured } from "@/lib/genlayer";
import { VerdictBadge } from "@/components/VerdictBadge";
import { CiteModal } from "@/components/CiteModal";
import { AppealButton } from "@/components/AppealButton";
import {
  formatSequence,
  truncateAddress,
  formatStake,
  compactUrl,
  verdictDescription,
  formatSettlementStatus,
  settlementStatusDetail,
} from "@/lib/format";

interface PageProps {
  params: { hash: string };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  if (!isContractConfigured()) return { title: "Verdict · Lemma" };
  const verdict = await fetchVerdictRecord(params.hash);
  if (!verdict) return { title: "Verdict not found · Lemma" };
  const seq = formatSequence(verdict.sequence);
  const settlement = verdict.settlement_status ?? "accepted";
  return {
    title: `Lemma Verdict No. ${seq} · ${verdict.label.replace(/_/g, " ")} · ${settlement}`,
    description: verdict.claim_text.slice(0, 200),
    openGraph: {
      title: `Lemma Verdict No. ${seq} · ${verdict.label.replace(/_/g, " ")} · ${settlement}`,
      description: verdict.claim_text.slice(0, 200),
      images: [
        {
          url: `/api/og/${params.hash}`,
          width: 1200,
          height: 630,
          alt: `Lemma Verdict No. ${seq}`,
        },
      ],
    },
  };
}

export default async function VerdictPage({ params }: PageProps) {
  if (!isContractConfigured()) {
    return (
      <div className="max-w-prose">
        <p className="editorial-label">Court not in session</p>
        <p className="mt-4 font-serif text-body italic text-ink-muted">
          The Lemma contract has not been configured for this deployment. Once
          the contract is published to Bradbury Testnet and the environment
          variable is set, this verdict page will render the on-chain record.
        </p>
      </div>
    );
  }

  return (
    <Suspense fallback={<VerdictSkeleton />}>
      <VerdictBody hash={params.hash} />
    </Suspense>
  );
}

async function VerdictBody({ hash }: { hash: string }) {
  const verdict = await fetchVerdictRecord(hash);
  if (!verdict) notFound();

  const seq = formatSequence(verdict.sequence);
  const description = verdictDescription(verdict.label);
  const settlement = verdict.settlement_status ?? "accepted";

  return (
    <article className="mx-auto max-w-prose space-y-section">
      {/* Masthead line ------------------------------------------------- */}
      <header>
        <p className="font-mono text-meta uppercase tracking-tracked text-ink-muted">
          Lemma · No. {seq}
          {verdict.appeal_count > 0 && (
            <span className="ml-3 text-rust">· appealed</span>
          )}
        </p>
        <p className={`settlement-note mt-3 ${settlement}`}>
          {formatSettlementStatus(settlement)}
        </p>
        <p className="mt-2 font-serif text-small italic text-ink-soft">
          {settlementStatusDetail(settlement)}
        </p>
      </header>

      {/* Verdict wordmark --------------------------------------------- */}
      <section>
        <p className="editorial-label">Verdict</p>
        <h1 className="mt-4">
          <VerdictBadge label={verdict.label} size="display" />
        </h1>
        <p className="mt-6 font-serif text-lead leading-relaxed text-ink drop-cap">
          {description}
        </p>
      </section>

      <hr className="hairline" />

      {/* The claim ---------------------------------------------------- */}
      <section>
        <p className="editorial-label">The claim</p>
        <blockquote className="mt-4 font-serif text-h3 leading-snug text-ink">
          &ldquo;{verdict.claim_text}&rdquo;
        </blockquote>
      </section>

      <hr className="hairline" />

      {/* Source ------------------------------------------------------- */}
      <section>
        <p className="editorial-label">Source</p>
        <a
          href={verdict.source_url}
          target="_blank"
          rel="noreferrer noopener"
          className="editorial-link mt-3 inline-block font-mono text-body break-all"
        >
          {compactUrl(verdict.source_url, 80)} →
        </a>
        {verdict.source_context && (
          <p className="mt-2 font-serif text-small italic text-ink-soft">
            {verdict.source_context}
          </p>
        )}
      </section>

      <hr className="hairline" />

      {/* Justification ----------------------------------------------- */}
      <section>
        <p className="editorial-label">Jury opinion</p>
        <p className="mt-4 font-serif text-body italic leading-relaxed text-ink">
          {verdict.justification}
        </p>
      </section>

      <hr className="hairline" />

      {/* Record ------------------------------------------------------- */}
      <section className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <Field label="Submitted by">
          <span className="font-mono text-body">
            {truncateAddress(verdict.submitter)}
          </span>
        </Field>
        <Field label="Stake consumed">
          <span className="font-mono text-body">
            {formatStake(verdict.stake_consumed)}
          </span>
        </Field>
        <Field label="Issue number">
          <span className="font-mono text-body">No. {seq}</span>
        </Field>
        <Field label="Appeals">
          <span className="font-mono text-body">
            {verdict.appeal_count} / 1
          </span>
        </Field>
        <Field label="Chain state">
          <span className={`settlement-note ${settlement}`}>
            {formatSettlementStatus(settlement)}
          </span>
        </Field>
      </section>

      <hr className="hairline-strong" />

      {/* Actions ----------------------------------------------------- */}
      <section className="no-print flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <CiteModal verdict={verdict} />
        <AppealButton verdict={verdict} />
      </section>

      {/* Permanent reference --------------------------------------- */}
      <section className="border-t border-divider pt-6">
        <p className="editorial-label">Permanent reference</p>
        <p className="mt-2 break-all font-mono text-meta text-ink-soft">
          lemma://verdict/{verdict.claim_hash}
        </p>
      </section>
    </article>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="editorial-label">{label}</p>
      <p className="mt-2">{children}</p>
    </div>
  );
}

function VerdictSkeleton() {
  return (
    <div className="mx-auto max-w-prose">
      <p className="font-serif text-body italic text-ink-muted caret-blink">
        Loading verdict from the chain
      </p>
    </div>
  );
}
