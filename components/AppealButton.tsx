"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Verdict } from "@/lib/abi";
import type { VerdictSettlementStatus } from "@/lib/abi";
import { useWallet } from "@/lib/wallet";
import { appealVerdict } from "@/lib/genlayer";
import type { TransactionLifecycleUpdate } from "@/lib/genlayer";
import { truncateHash } from "@/lib/format";

/**
 * Appeal action.
 *
 * Disabled if the verdict has already been appealed once (per the
 * contract's appeal_count cap). Otherwise, two-stage: an editorial
 * confirmation paragraph that explains the cost, then a real call to
 * the contract via genlayer-js writeContract.
 */
interface AppealButtonProps {
  verdict: Verdict;
}

type Phase = "idle" | "confirming" | "signing" | "pending" | "done" | "error";

export function AppealButton({ verdict }: AppealButtonProps) {
  const router = useRouter();
  const { address, connect } = useWallet();
  const [phase, setPhase] = useState<Phase>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);
  const [settlementStatus, setSettlementStatus] =
    useState<VerdictSettlementStatus>("accepted");
  const [consensusStatus, setConsensusStatus] =
    useState<TransactionLifecycleUpdate["consensusStatus"]>("UNKNOWN");

  const alreadyAppealed = verdict.appeal_count >= 1;
  const appealStake = BigInt(verdict.stake_consumed) * 5n;
  const appealStakeGen = (Number(appealStake) / 1e18).toFixed(3);

  if (alreadyAppealed) {
    return (
      <p className="font-serif text-small italic text-ink-muted">
        This verdict has already been appealed once. No further appeals are
        permitted under the v1 court procedure.
      </p>
    );
  }

  async function confirm() {
    if (!address) {
      await connect();
      return;
    }
    setErrorMessage(null);
    setPhase("signing");
    try {
      const result = await appealVerdict({
        account: address,
        claimHash: verdict.claim_hash,
        stake: appealStake,
        previousAppealCount: verdict.appeal_count,
      }, {
        onStatusChange: (update) => {
          setTxHash(update.txHash);
          setConsensusStatus(update.consensusStatus);
          if (update.lifecycle === "submitted") {
            setPhase("pending");
            return;
          }
          if (update.lifecycle === "finalized") {
            setSettlementStatus("finalized");
          }
        },
      });
      setTxHash(result.txHash);
      setSettlementStatus(result.settlementStatus);
      setPhase("done");
      router.refresh();
    } catch (e: unknown) {
      setErrorMessage(e instanceof Error ? e.message : "Appeal failed.");
      setPhase("error");
    }
  }

  if (phase === "idle") {
    return (
      <button
        type="button"
        className="btn"
        onClick={() => setPhase("confirming")}
      >
        Appeal verdict →
      </button>
    );
  }

  if (phase === "confirming") {
    return (
      <div className="max-w-prose space-y-4 border-l-2 border-rust pl-6">
        <p className="editorial-label">Confirm appeal</p>
        <p className="font-serif text-body text-ink">
          Filing an appeal costs five times the original stake, currently{" "}
          <span className="font-mono text-meta">{appealStakeGen} GEN</span>.
          The jury will re-deliberate with stricter scrutiny and may overturn
          or uphold the verdict. Only one appeal per claim is permitted.
        </p>
        <div className="flex gap-6">
          <button type="button" className="btn btn-primary" onClick={confirm}>
            Confirm appeal →
          </button>
          <button
            type="button"
            className="btn"
            onClick={() => setPhase("idle")}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (phase === "signing") {
    return (
      <p className="font-serif text-body text-ink-soft">
        <span className="caret-blink">Awaiting signature in your wallet</span>
      </p>
    );
  }

  if (phase === "pending") {
    const copy = describeAppealConsensusStatus(consensusStatus);
    return (
      <div className="space-y-2">
        <p className="font-serif text-body text-ink-soft">
          <span className="caret-blink">{copy}</span>
        </p>
        {txHash && (
          <p className="font-mono text-meta text-ink-muted">
            tx: {truncateHash(txHash, 10, 8)}
          </p>
        )}
      </div>
    );
  }

  if (phase === "done") {
    return (
      <p className="font-serif text-body text-ink-soft">
        {settlementStatus === "finalized"
          ? "Appeal finalized. The page is refreshing with the permanent record."
          : "Appeal accepted. The page is refreshing with the updated record."}
      </p>
    );
  }

  // error
  return (
    <div className="space-y-2">
      <p className="font-serif text-body italic text-wine">
        {errorMessage ?? "Appeal failed."}
      </p>
      <button type="button" className="btn" onClick={() => setPhase("idle")}>
        Try again →
      </button>
    </div>
  );
}

function describeAppealConsensusStatus(
  status: TransactionLifecycleUpdate["consensusStatus"],
): string {
  switch (status) {
    case "PENDING":
      return "Appeal submitted; Bradbury queued the transaction";
    case "PROPOSING":
      return "Appeal submitted; a leader is proposing the new jury round";
    case "COMMITTING":
      return "Appeal submitted; validators are committing votes";
    case "REVEALING":
      return "Appeal submitted; validators are revealing votes";
    case "ACCEPTED":
      return "Appeal accepted; locating the updated verdict record";
    case "READY_TO_FINALIZE":
      return "Appeal accepted; finalization window is open";
    case "FINALIZED":
      return "Appeal finalized; refreshing the permanent record";
    default:
      return "Appeal submitted; Bradbury is processing the new jury round";
  }
}
