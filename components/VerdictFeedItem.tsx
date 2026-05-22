import Link from "next/link";
import type { Verdict } from "@/lib/abi";
import {
  formatSequence,
  truncateAddress,
  formatLabel,
  formatSettlementStatus,
} from "@/lib/format";

interface VerdictFeedItemProps {
  verdict: Verdict;
  isLast?: boolean;
}

/**
 * VerdictFeedItem
 *
 * A single row in the recent verdicts feed. Two-column grid:
 *
 *   left  : "No. 0124" in mono - the gutter
 *   right : verdict word, claim in curly quotes, italic citation,
 *           right-justified metadata gutter (address · time)
 *
 * The whole row is wrapped in a Link so the entire surface is the
 * navigation target. Hover applies a subtle warm tint and switches
 * the citation underline from divider to rust.
 *
 * The "field tag" subline in the design prototype is intentionally
 * omitted in v1: the contract does not record a discipline label and
 * the handoff README explicitly authorises dropping it ("the design
 * works without it").
 */
export function VerdictFeedItem({ verdict, isLast = false }: VerdictFeedItemProps) {
  const seq = formatSequence(verdict.sequence);
  const labelClass = `verdict-word ${verdict.label}`;

  return (
    <li className={`feed-row${isLast ? " last" : ""}`}>
      <Link
        href={`/v/${verdict.claim_hash}`}
        className="feed-row-link"
        aria-label={`Verdict No. ${seq}`}
      >
        {/* Left gutter: number ----------------------------------- */}
        <div className="feed-sequence mono">
          No. {seq}
        </div>

        {/* Right body -------------------------------------------- */}
        <div className="feed-body">
          <div className="feed-verdict">
            <span className={labelClass}>{formatLabel(verdict.label)}</span>
            <span
              className={`feed-settlement ${verdict.settlement_status ?? "accepted"}`}
            >
              {formatSettlementStatus(verdict.settlement_status ?? "accepted")}
            </span>
            {verdict.appeal_count > 0 && (
              <span className="feed-appeal caps-sm">
                · appealed
              </span>
            )}
          </div>

          <p className="feed-claim font-serif claim">
            {verdict.claim_text}
          </p>

          <div className="feed-citation font-serif italic">
            cited from{" "}
            <span className="src">
              {compactCitation(verdict.source_url, verdict.source_context)}
            </span>
          </div>

          <div className="feed-meta meta">
            <span className="feed-meta-primary">{truncateAddress(verdict.submitter)}</span>
            <span className="feed-meta-sep">·</span>
            <span className="feed-meta-muted">{formatStakeShort(verdict.stake_consumed)}</span>
          </div>
        </div>
      </Link>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function compactCitation(url: string, context: string): string {
  let body: string;
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    const path = u.pathname.replace(/\/$/, "");
    body = path ? `${host}${path}` : host;
  } catch {
    body = url;
  }

  // Trim if very long.
  if (body.length > 40) body = body.slice(0, 39) + "…";

  if (context && context.trim().length > 0) {
    const ctx = context.trim();
    body = `${body} · ${ctx.length > 24 ? ctx.slice(0, 23) + "…" : ctx}`;
  }
  return body;
}

function formatStakeShort(baseUnits: number): string {
  if (!Number.isFinite(baseUnits) || baseUnits <= 0) return "0 GEN";
  const gen = baseUnits / 1e18;
  // Three significant fractional digits, trimmed.
  let s = gen.toFixed(3);
  s = s.replace(/0+$/, "").replace(/\.$/, "");
  return `${s} GEN`;
}
