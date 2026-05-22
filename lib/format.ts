/**
 * Editorial formatters.
 *
 * Every visible piece of data in Lemma passes through one of these so
 * the typographic treatment is consistent: hashes are truncated middle,
 * addresses use a fixed-width abbreviation, timestamps render in a
 * journal-like relative form ("3 hours ago", "May 15, 2026"), and
 * stakes drop trailing zeros so 0.00100000 GEN reads as 0.001 GEN.
 */

import type { VerdictLabel, VerdictSettlementStatus } from "./abi";

const SECOND = 1_000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export function truncateHash(hash: string, head = 6, tail = 4): string {
  if (!hash) return "";
  if (hash.length <= head + tail + 2) return hash;
  return `${hash.slice(0, head)}…${hash.slice(-tail)}`;
}

export function truncateAddress(addr: string): string {
  if (!addr) return "";
  return truncateHash(addr, 6, 4);
}

/**
 * Format a verdict's sequence number as a four-digit issue number:
 *   1   -> "0001"
 *   123 -> "0123"
 * Padded to four digits because that's what the masthead expects.
 */
export function formatSequence(seq: number): string {
  if (!Number.isFinite(seq) || seq < 0) return "0000";
  return seq.toString().padStart(4, "0");
}

/**
 * Render a stake amount stored in base units (10^18) as a clean decimal
 * GEN string. Strips trailing zeros but keeps at least 3 fractional
 * digits so "0.001" doesn't collapse to "0.001" vs "0".
 */
export function formatStake(baseUnits: number | bigint): string {
  const big = typeof baseUnits === "bigint" ? baseUnits : BigInt(Math.trunc(baseUnits));
  const whole = big / 10n ** 18n;
  const remainder = big % 10n ** 18n;
  if (remainder === 0n) return `${whole.toString()} GEN`;
  const padded = remainder.toString().padStart(18, "0");
  let frac = padded.replace(/0+$/, "");
  if (frac.length < 3) frac = frac.padEnd(3, "0");
  return `${whole.toString()}.${frac} GEN`;
}

/**
 * Render a verdict label as it should appear in display type.
 * Lowercase, no underscores: "partially_verified" -> "partially verified".
 */
export function formatLabel(label: VerdictLabel): string {
  return label.replace(/_/g, " ");
}

export function formatSettlementStatus(status: VerdictSettlementStatus): string {
  return status === "finalized" ? "finalized" : "accepted";
}

export function settlementStatusDetail(status: VerdictSettlementStatus): string {
  return status === "finalized"
    ? "Finalized on Bradbury. This record is now permanent."
    : "Accepted on Bradbury. The appeal and finalization window is still open.";
}

/**
 * Editorial date stamp: "May 15, 2026".
 */
export function formatDate(d: Date): string {
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Editorial relative time. Used in the feed. Falls back to the date
 * once a verdict is older than a week, because "47 days ago" reads
 * worse than "Apr 1, 2026" in a journal context.
 */
export function formatRelative(date: Date, now: Date = new Date()): string {
  const diff = now.getTime() - date.getTime();
  if (diff < MINUTE) return "just now";
  if (diff < HOUR) {
    const m = Math.floor(diff / MINUTE);
    return `${m} minute${m === 1 ? "" : "s"} ago`;
  }
  if (diff < DAY) {
    const h = Math.floor(diff / HOUR);
    return `${h} hour${h === 1 ? "" : "s"} ago`;
  }
  const days = Math.floor(diff / DAY);
  if (days <= 7) {
    return `${days} day${days === 1 ? "" : "s"} ago`;
  }
  return formatDate(date);
}

/**
 * Extract a clean display host from an arbitrary URL, used in the
 * "cited from arxiv.org/abs/..." feed line.
 */
export function compactUrl(url: string, maxLen = 56): string {
  try {
    const u = new URL(url);
    const display = `${u.hostname}${u.pathname}`.replace(/\/$/, "");
    if (display.length <= maxLen) return display;
    return `${display.slice(0, maxLen - 1)}…`;
  } catch {
    return url.length > maxLen ? `${url.slice(0, maxLen - 1)}…` : url;
  }
}

/**
 * Human description for each verdict label, used as the lead paragraph
 * under the wordmark on the verdict page.
 */
export function verdictDescription(label: VerdictLabel): string {
  switch (label) {
    case "verified":
      return "The claim is faithfully supported by the cited source. The validators reached consensus on this label.";
    case "partially_verified":
      return "The source supports parts of the claim but with caveats the claim omits. The validators agreed on partial support.";
    case "misrepresented":
      return "The source contradicts the claim or distorts what the source actually said. The validators reached consensus on misrepresentation.";
    case "unsupported":
      return "The source does not address the claim. The validators agreed that the citation does not provide evidence.";
    case "unverifiable":
      return "The source could not be read with enough confidence to issue a verdict. This is usually a paywall, an empty page, or a fetch failure.";
    default:
      return "The verdict label is unrecognised.";
  }
}
