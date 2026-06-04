"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/lib/wallet";
import { validateClaimInputs } from "@/lib/abi";
import {
  submitClaimTransaction,
  ContractNotDeployedError,
  isContractConfigured,
} from "@/lib/genlayer";

/**
 * Submission form.
 *
 * This component only carries the user through wallet signature and tx
 * submission. Once Bradbury returns a tx hash, the UI moves to the
 * verdict route and lets that page own the long-running consensus
 * lifecycle.
 */

type Phase = "idle" | "signing" | "error";

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
      const result = await submitClaimTransaction({
        account: address,
        claimText: claimText.trim(),
        sourceUrl: sourceUrl.trim(),
        sourceContext: sourceContext.trim(),
        stake,
      });
      router.push(`/v/${result.claimHash}?tx=${result.txHash}`, {
        scroll: true,
      });
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
          source, read it, and issue a verdict. The next page tracks the live
          Bradbury stages until the readable record appears.
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
  variant?: "default" | "error";
}

function StateBlock({ label, body, variant = "default" }: StateBlockProps) {
  return (
    <section className="max-w-prose">
      <p
        className={`editorial-label ${variant === "error" ? "text-wine" : ""}`}
      >
        {label} <span className="caret-blink" aria-hidden="true" />
      </p>
      <p className="mt-4 font-serif text-lead leading-relaxed text-ink">{body}</p>
    </section>
  );
}
