import {
  fetchRecentVerdicts,
  fetchStatsSnapshot,
  isContractConfigured,
} from "@/lib/genlayer";
import { VerdictFeedItem } from "@/components/VerdictFeedItem";
import { formatStake } from "@/lib/format";

export const revalidate = 30;

export const metadata = {
  title: "Dashboard · Lemma",
  description:
    "Aggregate verdict statistics and the full docket of recent Lemma decisions.",
};

export default async function DashboardPage() {
  if (!isContractConfigured()) {
    return (
      <div className="max-w-prose">
        <p className="editorial-label">Court not in session</p>
        <p className="mt-4 font-serif text-body italic text-ink-muted">
          Dashboard statistics will appear here once the contract is deployed.
        </p>
      </div>
    );
  }

  let stats;
  let verdicts;
  try {
    [stats, verdicts] = await Promise.all([
      fetchStatsSnapshot(),
      fetchRecentVerdicts(50),
    ]);
  } catch {
    return (
      <div className="max-w-prose">
        <p className="font-serif text-body italic text-ink-muted">
          The dashboard is temporarily unavailable. Bradbury Testnet returned
          a transient error. Please refresh shortly.
        </p>
      </div>
    );
  }

  const acceptedTotal = stats.accepted.total_claims || 1;
  const finalizedTotal = stats.finalized.total_claims || 1;

  return (
    <div className="space-y-section">
      <header className="max-w-prose">
        <p className="editorial-label">Statistics of the court</p>
        <h1 className="mt-4 font-serif text-h1 leading-tight text-ink">
          The docket in numbers.
        </h1>
        <p className="mt-4 font-serif text-lead italic leading-relaxed text-ink-soft">
          A full record of verdicts issued by the court, set as it would
          appear in the back matter of a printed journal. Accepted records are
          visible immediately; finalized records are the permanent docket.
        </p>
      </header>

      <hr className="hairline" />

      {/* Summary table -------------------------------------------------- */}
      <section className="max-w-wide">
        <p className="editorial-label">Verdict distribution</p>
        <table className="mt-6 w-full border-collapse">
          <thead>
            <tr className="border-b border-divider">
              <Th align="left">Label</Th>
              <Th align="right">Accepted</Th>
              <Th align="right">Finalized</Th>
            </tr>
          </thead>
          <tbody>
            <Row
              label="Verified"
              acceptedCount={stats.accepted.verified}
              finalizedCount={stats.finalized.verified}
            />
            <Row
              label="Partially verified"
              acceptedCount={stats.accepted.partially_verified}
              finalizedCount={stats.finalized.partially_verified}
            />
            <Row
              label="Misrepresented"
              acceptedCount={stats.accepted.misrepresented}
              finalizedCount={stats.finalized.misrepresented}
              accent
            />
            <Row
              label="Unsupported"
              acceptedCount={stats.accepted.unsupported}
              finalizedCount={stats.finalized.unsupported}
            />
            <Row
              label="Unverifiable"
              acceptedCount={stats.accepted.unverifiable}
              finalizedCount={stats.finalized.unverifiable}
              muted
            />
            <tr className="border-t border-ink-soft">
              <Th align="left">Total</Th>
              <td className="py-2 text-right font-mono text-body text-ink">
                {stats.accepted.total_claims}
              </td>
              <td className="py-2 text-right font-mono text-body text-ink">
                {stats.finalized.total_claims}
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="max-w-wide grid grid-cols-1 gap-8 sm:grid-cols-3">
        <Card title="Minimum stake">
          <span className="font-mono text-h2 text-ink">
            {formatStake(stats.accepted.min_stake)}
          </span>
        </Card>
        <Card title="Appeal multiplier">
          <span className="font-mono text-h2 text-ink">
            {stats.accepted.appeal_multiplier}×
          </span>
        </Card>
        <Card title="Finalized share">
          <span className="font-mono text-h2 text-ink">
            {((stats.finalized.total_claims / acceptedTotal) * 100).toFixed(1)}%
          </span>
        </Card>
      </section>

      <hr className="ornament" />

      {/* Full feed ------------------------------------------------------- */}
      <section className="max-w-prose">
        <p className="editorial-label">Recent verdicts</p>
        <hr className="hairline mt-4" />
        {verdicts.length === 0 ? (
          <p className="mt-6 font-serif text-body italic text-ink-muted">
            No verdicts have been issued yet.
          </p>
        ) : (
          <ul className="feed">
            {verdicts.map((v, i) => (
              <VerdictFeedItem
                key={v.claim_hash}
                verdict={v}
                isLast={i === verdicts.length - 1}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Th({
  children,
  align,
}: {
  children: React.ReactNode;
  align: "left" | "right";
}) {
  return (
    <th
      className={`pb-2 font-mono text-meta uppercase tracking-tracked text-ink-soft ${
        align === "right" ? "text-right" : "text-left"
      }`}
      scope="col"
    >
      {children}
    </th>
  );
}

function Row({
  label,
  acceptedCount,
  finalizedCount,
  accent,
  muted,
}: {
  label: string;
  acceptedCount: number;
  finalizedCount: number;
  accent?: boolean;
  muted?: boolean;
}) {
  return (
    <tr className="border-b border-divider">
      <td
        className={`py-2 font-serif text-body ${
          accent ? "text-rust-deep" : muted ? "text-ink-muted" : "text-ink"
        }`}
      >
        {label}
      </td>
      <td className="py-2 text-right font-mono text-body text-ink">{acceptedCount}</td>
      <td className="py-2 text-right font-mono text-body text-ink-soft">{finalizedCount}</td>
    </tr>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-divider pt-4">
      <p className="editorial-label">{title}</p>
      <div className="mt-2">{children}</div>
    </div>
  );
}
