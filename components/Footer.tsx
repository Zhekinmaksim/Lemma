import {
  fetchStatsSnapshot,
  getContractAddress,
  isContractConfigured,
} from "@/lib/genlayer";
import { unstable_noStore as noStore } from "next/cache";

/**
 * Footer
 *
 * Three columns: The Court (contract address + chain), Standing (live
 * counts from `get_stats`), Correspondence (links). Followed by a
 * centred colophon line.
 *
 * Per the handoff: only display stats we actually have on-chain. The
 * "validators online" and "first-vote consensus" metrics in the
 * prototype's fixture are network-level metrics not exposed by the
 * Lemma contract; v1 of the footer surfaces verdict-filing data
 * instead, which the contract does record.
 */

const REPO = process.env.NEXT_PUBLIC_REPO_URL ?? "https://github.com/Zhekinmaksim/lemma";

interface FooterStats {
  acceptedTotal: number | null;
  finalizedTotal: number | null;
  finalizedVerified: number | null;
}

async function loadStats(): Promise<FooterStats> {
  if (!isContractConfigured()) {
    return {
      acceptedTotal: null,
      finalizedTotal: null,
      finalizedVerified: null,
    };
  }
  try {
    const snapshot = await fetchStatsSnapshot();
    return {
      acceptedTotal: snapshot.accepted.total_claims,
      finalizedTotal: snapshot.finalized.total_claims,
      finalizedVerified: snapshot.finalized.verified,
    };
  } catch {
    return {
      acceptedTotal: null,
      finalizedTotal: null,
      finalizedVerified: null,
    };
  }
}

export async function Footer() {
  noStore();
  const stats = await loadStats();
  const contractAddress = isContractConfigured() ? getContractAddress() : "";
  const verifiedRate =
    stats.finalizedTotal &&
    stats.finalizedVerified !== null &&
    stats.finalizedTotal > 0
      ? ((stats.finalizedVerified / stats.finalizedTotal) * 100).toFixed(1)
      : null;

  return (
    <>
      <footer
        className="grid"
        style={{
          marginTop: "4rem",
          paddingTop: "1.4rem",
          borderTop: "1px solid var(--lemma-ink)",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: "2rem",
          color: "var(--lemma-ink-soft)",
          fontSize: "0.92rem",
        }}
      >
        <FooterColumn title="The Court">
          <p
            className="mono"
            style={{
              fontSize: "0.86rem",
              color: "var(--lemma-ink)",
              wordBreak: "break-all",
              margin: 0,
            }}
          >
            {contractAddress || "not yet deployed"}
          </p>
          <p className="meta" style={{ marginTop: "0.4rem" }}>
            Bradbury Testnet
          </p>
        </FooterColumn>

        <FooterColumn title="Standing">
          {stats.acceptedTotal === null ? (
            <p style={{ margin: 0, color: "var(--lemma-ink-muted)", fontStyle: "italic" }}>
              The court is not yet in session.
            </p>
          ) : (
            <>
              <p style={{ margin: 0 }}>
                <span className="mono">{stats.acceptedTotal}</span> accepted
              </p>
              <p style={{ margin: 0 }}>
                <span className="mono">{stats.finalizedTotal}</span> finalized
              </p>
              {verifiedRate !== null && (
                <p style={{ margin: 0 }}>
                  <span className="mono">{verifiedRate}%</span> finalized verified
                </p>
              )}
              <p style={{ margin: 0 }}>
                <span className="mono">5</span> validators per jury
              </p>
            </>
          )}
        </FooterColumn>

        <FooterColumn title="Correspondence">
          <p style={{ margin: 0 }}>
            <a className="u-link" href="/about">
              About &amp; methodology
            </a>
          </p>
          <p style={{ margin: 0 }}>
            <a className="u-link" href={REPO} target="_blank" rel="noreferrer noopener">
              Source on GitHub
            </a>
          </p>
          <p style={{ margin: 0 }}>
            <a className="u-link" href="/dashboard">
              Dashboard
            </a>
          </p>
        </FooterColumn>
      </footer>

      <div
        className="caps-sm"
        style={{
          marginTop: "2.5rem",
          textAlign: "center",
          color: "var(--lemma-ink-muted)",
          fontSize: "0.7rem",
        }}
      >
        Set in Newsreader &amp; IBM Plex Mono · Printed on cream · MMXXVI
      </div>
    </>
  );
}

function FooterColumn({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="footer-col">
      <h4
        className="font-mono uppercase"
        style={{
          fontSize: "0.7rem",
          letterSpacing: "0.16em",
          fontWeight: 500,
          color: "var(--lemma-ink-muted)",
          margin: "0 0 0.55rem",
        }}
      >
        {title}
      </h4>
      {children}
    </div>
  );
}
