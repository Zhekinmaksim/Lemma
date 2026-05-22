/**
 * Lemma contract ABI.
 *
 * This is the human-readable view of the public surface of lemma.py.
 * The genlayer-js client uses functionName/args directly and does not
 * require a Solidity-style ABI, but we keep this typed surface here so
 * the frontend has a single source of truth for method signatures and
 * the dashboard / forms don't drift out of sync with the contract.
 */

export const LEMMA_METHODS = {
  // ---- writes ----
  submitClaim: "submit_claim",
  appeal: "appeal",
  // ---- views ----
  getVerdict: "get_verdict",
  hasVerdict: "has_verdict",
  getStats: "get_stats",
  getRecentClaims: "get_recent_claims",
  getSubmitterCount: "get_submitter_count",
} as const;

export type VerdictLabel =
  | "verified"
  | "partially_verified"
  | "misrepresented"
  | "unsupported"
  | "unverifiable";

export type VerdictSettlementStatus = "accepted" | "finalized";

export const VERDICT_LABELS: ReadonlyArray<VerdictLabel> = [
  "verified",
  "partially_verified",
  "misrepresented",
  "unsupported",
  "unverifiable",
];

export interface Verdict {
  claim_hash: string;
  claim_text: string;
  source_url: string;
  source_context: string;
  submitter: string;
  label: VerdictLabel;
  justification: string;
  sequence: number;
  appeal_count: number;
  stake_consumed: number;
  settlement_status?: VerdictSettlementStatus;
}

export interface LemmaStats {
  total_claims: number;
  verified: number;
  partially_verified: number;
  misrepresented: number;
  unsupported: number;
  unverifiable: number;
  min_stake: number;
  appeal_multiplier: number;
}

/**
 * Soft validator. The contract enforces the hard limits; this gives the
 * UI a fast feedback path so the user doesn't have to wait for a
 * reverted transaction to learn their input was malformed.
 */
export function validateClaimInputs(
  claimText: string,
  sourceUrl: string,
  sourceContext: string,
): string | null {
  const trimmed = claimText.trim();
  if (trimmed.length < 10) {
    return "The claim must be at least 10 characters.";
  }
  if (trimmed.length > 2000) {
    return "The claim must be at most 2000 characters.";
  }
  if (!sourceUrl.startsWith("https://")) {
    return "The source URL must begin with https://";
  }
  if (sourceUrl.length > 500) {
    return "The source URL is too long (max 500 characters).";
  }
  if (sourceContext.length > 1000) {
    return "Source context is too long (max 1000 characters).";
  }
  return null;
}
