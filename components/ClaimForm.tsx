"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/lib/wallet";
import type { VerdictSettlementStatus } from "@/lib/abi";
import { validateClaimInputs } from "@/lib/abi";
import { submitClaim, ContractNotDeployedError, isContractConfigured } from "@/lib/genlayer";
import { truncateHash } from "@/lib/format";

/**
 * The full submission flow.
 *
 * The state machine follows the spec:
 *   IDLE → FORM_FILLING → SIGNING_TX → TX_PENDING → JURY_DELIBERATING → DONE
 *
 * Each state has a typographic representation, not a UI gimmick. The
 * only motion in the entire flow is the caret-blink on the loading
 * states. No spinner, no progress bar, no toast.
 */

type Phase = "idle" | "signing" | "pending" | "deliberating" | "done" | "error";

const MIN_STAKE_BASE = 1_000_000_000_000_000n; // 0.001 GEN in base units

export function ClaimForm() {
  const router = useRouter();
  const { address, connect, connecting } = useWallet();

  const [claimText, setClaimText] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceContext, setSourceContext] = useState("");
  const [stakeMultiplier, setStakeMultiplier] = useState(1); // multiples of MIN_STAKE
  const [phase, setPhase] = useState<Phase>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);
  const [claimHash, setClaimHash] = useState<string | null>(null);
  const [settlementStatus, setSettlementStatus] =
    useState<VerdictSettlementStatus>("accepted");

  const charCount = claimText.length;
  const inlineError = useMemo(
    () => validateClaimInputs(claimText, sourceUrl, sourceContext),
    [claimText, sourceUrl, sourceContext],
  );
  const stake = BigInt(stakeMultiplier) * MIN_STAKE_BASE;
  const stakeDisplay = (Number(stake) / 1e18).toFixed(3);
  const canSubmit =
    phase === "idle" &&
    address !== null &&
    inlineError === null &&
    isContractConfigured();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!address) return;
    if (inlineError) return;

    setErrorMessage(null);
    setPhase("signing");

    try {
      setPhase("signing");
      const result = await submitClaim({
        account: address,
        claimText: claimText.trim(),
        sourceUrl: sourceUrl.trim(),
        sourceContext: sourceContext.trim(),
        stake,
      }, {
        onStatusChange: (update) => {
          setTxHash(update.txHash);
          if (update.lifecycle === "submitted") {
            setPhase("pending");
            return;
          }
          if (update.lifecycle === "accepted") {
            setPhase("deliberating");
            return;
          }
          setSettlementStatus("finalized");
        },
      });
      setTxHash(result.txHash);
      setClaimHash(result.claimHash);
      setSettlementStatus(result.settlementStatus);
      setPhase("done");
      setTimeout(() => router.push(`/v/${result.claimHash}`), 600);
    } catch (err: unknown) {
      if (err instanceof ContractNotDeployedError) {
        setErrorMessage(
          "The court is not yet in session: the Lemma contract address has not been configured.",
        );
      } else if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage("Submission failed for an unknown reason.");
      }
      setPhase("error");
    }
  }

  function reset() {
    setPhase("idle");
    setErrorMessage(null);
    setTxHash(null);
    setClaimHash(null);
    setSettlementStatus("accepted");
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  if (phase === "signing") {
    return (
      <StateBlock
        label="Awaiting signature"
        body="Confirm the transaction in your wallet. The conviction stake is held by the contract while the jury deliberates."
      />
    );
  }

  if (phase === "pending") {
    return (
      <StateBlock
        label="Transaction submitted"
        body="The claim has been submitted to Bradbury. A leader is being selected and the jury is about to deliberate."
        meta={txHash ? `tx: ${truncateHash(txHash, 10, 8)}` : undefined}
      />
    );
  }

  if (phase === "deliberating") {
    return (
      <StateBlock
        label="Accepted; locating record"
        body="Bradbury accepted the claim, but the UI has not yet resolved the claim hash from the receipt. The accepted record should surface in the feed shortly; finalization may take longer."
        meta={txHash ? `tx: ${truncateHash(txHash, 10, 8)}` : undefined}
        action={
          <button type="button" className="btn" onClick={reset}>
            Submit another claim
          </button>
        }
      />
    );
  }

  if (phase === "done" && claimHash) {
    const body =
      settlementStatus === "finalized"
        ? "The verdict record is finalized on Bradbury and the page is opening now."
        : "The verdict record is live on Bradbury and the page is opening now. Finalization may follow after the appeal window closes.";
    return (
      <StateBlock
        label={
          settlementStatus === "finalized"
            ? "Finalized by the jury"
            : "Accepted by the jury"
        }
        body={body}
        meta={`hash: ${truncateHash(claimHash, 10, 8)}`}
      />
    );
  }

  if (phase === "error") {
    return (
      <div className="space-y-4">
        <StateBlock
          label="The submission did not complete"
          body={errorMessage ?? "An unknown error occurred."}
          variant="error"
        />
        <button type="button" className="btn" onClick={reset}>
          Try again →
        </button>
      </div>
    );
  }

  // ---- Idle / form state ----

  return (
    <form onSubmit={handleSubmit} className="space-y-section">
      {/* THE CLAIM ---------------------------------------------------------- */}
      <div>
        <label htmlFor="claim" className="editorial-label block">
          The claim
        </label>
        <textarea
          id="claim"
          name="claim"
          className="input textarea mt-3 text-lead"
          rows={5}
          maxLength={2000}
          placeholder="e.g. 'Smith et al. (2023) demonstrated a 15% reduction in training compute when applying gradient checkpointing…'"
          value={claimText}
          onChange={(e) => setClaimText(e.target.value)}
          required
        />
        <div className="mt-2 flex items-baseline justify-between">
          <p className="font-serif text-small italic text-ink-muted">
            Phrase the claim as a single self-contained statement that the
            source either confirms or contradicts.
          </p>
          <span className="font-mono text-meta text-ink-muted">
            {charCount} / 2000
          </span>
        </div>
      </div>

      {/* SOURCE URL --------------------------------------------------------- */}
      <div>
        <label htmlFor="source" className="editorial-label block">
          Source URL
        </label>
        <input
          id="source"
          name="source"
          type="url"
          className="input input-mono mt-3"
          placeholder="https://arxiv.org/abs/…"
          value={sourceUrl}
          onChange={(e) => setSourceUrl(e.target.value)}
          required
        />
        <p className="mt-2 font-serif text-small italic text-ink-muted">
          The cited page must be publicly fetchable. Paywalled, JavaScript-only,
          or login-gated sources tend to resolve as <em>unverifiable</em>.
        </p>
      </div>

      {/* SOURCE CONTEXT ---------------------------------------------------- */}
      <div>
        <label htmlFor="context" className="editorial-label block">
          Source context <span className="text-ink-muted">- optional</span>
        </label>
        <input
          id="context"
          name="context"
          className="input mt-3"
          maxLength={1000}
          placeholder="page, section, or timestamp"
          value={sourceContext}
          onChange={(e) => setSourceContext(e.target.value)}
        />
        <p className="mt-2 font-serif text-small italic text-ink-muted">
          Advisory only: the jury will see this but evaluates against the
          source itself, not your description.
        </p>
      </div>

      {/* STAKE -------------------------------------------------------------- */}
      <div>
        <label htmlFor="stake" className="editorial-label block">
          Conviction stake
        </label>
        <div className="mt-3 flex items-baseline gap-6">
          <span className="font-mono text-h2 text-ink">{stakeDisplay}</span>
          <span className="font-mono text-meta uppercase tracking-tracked text-ink-muted">
            GEN
          </span>
        </div>
        <input
          id="stake"
          type="range"
          min={1}
          max={50}
          step={1}
          value={stakeMultiplier}
          onChange={(e) => setStakeMultiplier(Number(e.target.value))}
          className="mt-3 w-full accent-rust-deep"
        />
        <p className="mt-2 font-serif text-small italic text-ink-muted">
          The minimum stake is 0.001 GEN. Higher stakes do not influence the
          jury&rsquo;s evaluation, but increase the cost of an unjustified
          submission and the cost of an appeal (5× this amount).
        </p>
      </div>

      <hr className="hairline-strong" />

      {/* SUBMIT ------------------------------------------------------------- */}
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <p className="font-serif text-small text-ink-soft sm:max-w-prose">
          When you submit, a jury of validators will independently fetch your
          source, read it, and issue a verdict. This typically takes thirty
          to sixty seconds.
        </p>

        <div className="flex flex-col items-start gap-2 sm:items-end">
          {!isContractConfigured() && (
            <p className="font-serif text-small italic text-wine">
              The court is not yet in session.
            </p>
          )}
          {inlineError && (
            <p className="font-serif text-small italic text-wine">
              {inlineError}
            </p>
          )}
          {!address ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={connect}
              disabled={connecting}
            >
              {connecting ? (
                <span className="caret-blink">Connecting</span>
              ) : (
                "Connect wallet →"
              )}
            </button>
          ) : (
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!canSubmit}
            >
              Submit claim →
            </button>
          )}
        </div>
      </div>
    </form>
  );
}

// ===========================================================================
// Reusable state block (signing / pending / deliberating / done / error)
// ===========================================================================

interface StateBlockProps {
  label: string;
  body: string;
  meta?: string;
  variant?: "default" | "error";
  action?: React.ReactNode;
}

function StateBlock({ label, body, meta, variant = "default", action }: StateBlockProps) {
  return (
    <section className="max-w-prose">
      <p
        className={`editorial-label ${variant === "error" ? "text-wine" : ""}`}
      >
        {label} <span className="caret-blink" aria-hidden="true" />
      </p>
      <p className="mt-4 font-serif text-lead leading-relaxed text-ink">{body}</p>
      {meta && (
        <p className="mt-6 font-mono text-meta text-ink-muted">{meta}</p>
      )}
      {action && <div className="mt-8">{action}</div>}
    </section>
  );
}
