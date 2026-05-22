import Link from "next/link";
import {
  fetchRecentVerdicts,
  fetchStatsSnapshot,
  isContractConfigured,
} from "@/lib/genlayer";
import { VerdictFeedItem } from "./VerdictFeedItem";
import { formatSequence } from "@/lib/format";

interface VerdictFeedProps {
  /** Maximum rows to render. Defaults to 8 per the design handoff. */
  limit?: number;
}

/**
 * VerdictFeed
 *
 * The recent verdicts section on the landing page. A bordered section
 * head with "Recent verdicts" on the left and a "No. 0117 - No. 0124"
 * range on the right (derived from the rendered items), then a list
 * of rows, then a small foot row linking to the dashboard.
 *
 * This is a server component that reads from the chain on render.
 * Caching policy is decided by the route that mounts it (page.tsx
 * sets `revalidate: 30`).
 */
export async function VerdictFeed({ limit = 8 }: VerdictFeedProps) {
  if (!isContractConfigured()) {
    return (
      <section id="feed" style={{ marginTop: "3rem" }}>
        <SectionHead range={null} />
        <p
          className="font-serif italic"
          style={{
            margin: "2rem 0 0",
            color: "var(--lemma-ink-muted)",
          }}
        >
          The court is not yet in session. The first verdicts will appear here
          once the contract has been deployed to Bradbury Testnet.
        </p>
      </section>
    );
  }

  let verdicts;
  let acceptedTotal: number | null = null;
  let finalizedTotal: number | null = null;

  try {
    const [v, stats] = await Promise.all([
      fetchRecentVerdicts(limit),
      fetchStatsSnapshot().catch(() => null),
    ]);
    verdicts = v;
    acceptedTotal = stats?.accepted.total_claims ?? null;
    finalizedTotal = stats?.finalized.total_claims ?? null;
  } catch {
    return (
      <section id="feed" style={{ marginTop: "3rem" }}>
        <SectionHead range={null} />
        <p
          className="font-serif italic"
          style={{
            margin: "2rem 0 0",
            color: "var(--lemma-ink-muted)",
          }}
        >
          The recent feed is temporarily unavailable. Bradbury Testnet
          occasionally returns transient errors; refresh shortly.
        </p>
      </section>
    );
  }

  if (verdicts.length === 0) {
    return (
      <section id="feed" style={{ marginTop: "3rem" }}>
        <SectionHead range={null} />
        <p
          className="font-serif italic"
          style={{
            margin: "2rem 0 0",
            color: "var(--lemma-ink-muted)",
          }}
        >
          No verdicts have been issued yet. Be the first to submit a claim.
        </p>
      </section>
    );
  }

  const newest = formatSequence(verdicts[0].sequence);
  const oldest = formatSequence(verdicts[verdicts.length - 1].sequence);
  const rangeLabel =
    verdicts.length === 1 ? `No. ${newest}` : `No. ${oldest} - No. ${newest}`;

  return (
    <section id="feed" style={{ marginTop: "3rem" }}>
      <SectionHead range={rangeLabel} />

      <ul className="feed">
        {verdicts.map((v, i) => (
          <VerdictFeedItem
            key={v.claim_hash}
            verdict={v}
            isLast={i === verdicts.length - 1}
          />
        ))}
      </ul>

      <div
        className="flex items-baseline"
        style={{
          justifyContent: "space-between",
          paddingTop: "1.1rem",
        }}
      >
        <span className="meta">
          {acceptedTotal ?? "-"} accepted · {finalizedTotal ?? "-"} finalized
        </span>
        <Link
          href="/dashboard"
          className="u-link mono caps-sm"
          style={{ fontSize: "0.72rem" }}
        >
          browse the archive &rarr;
        </Link>
      </div>
    </section>
  );
}

function SectionHead({ range }: { range: string | null }) {
  return (
    <div
      className="flex items-baseline"
      style={{
        justifyContent: "space-between",
        paddingBottom: "0.5rem",
        borderBottom: "1px solid var(--lemma-ink)",
      }}
    >
      <h2
        className="font-mono uppercase"
        style={{
          fontSize: "0.78rem",
          letterSpacing: "0.18em",
          fontWeight: 500,
          margin: 0,
        }}
      >
        Recent verdicts
      </h2>
      {range && (
        <span
          className="mono"
          style={{
            color: "var(--lemma-ink-muted)",
            fontSize: "0.78rem",
          }}
        >
          {range}
        </span>
      )}
    </div>
  );
}
