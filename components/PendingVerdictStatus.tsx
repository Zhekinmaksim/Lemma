"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Hash } from "viem";
import { TransactionStatus } from "genlayer-js/types";
import {
  fetchConsensusTransactionStatus,
  fetchConsensusTransactionReceipt,
  fetchVerdictRecord,
} from "@/lib/genlayer";
import type { Verdict } from "@/lib/abi";
import { truncateHash } from "@/lib/format";

interface PendingVerdictStatusProps {
  claimHash: string;
  txHash: Hash;
}

type ConsensusSnapshot = Awaited<ReturnType<typeof fetchConsensusTransactionStatus>>;
type ConsensusStage = TransactionStatus | "UNKNOWN";
const STUCK_PENDING_SECONDS = 90;

export function PendingVerdictStatus({
  claimHash,
  txHash,
}: PendingVerdictStatusProps) {
  const uninitializedStreakRef = useRef(0);
  const [status, setStatus] = useState<ConsensusSnapshot["status"]>(
    TransactionStatus.PENDING,
  );
  const [statusCode, setStatusCode] = useState<number | null>(1);
  const [rpcMessage, setRpcMessage] = useState<string | null>(null);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [recordDetected, setRecordDetected] = useState(false);
  const [pendingAt, setPendingAt] = useState<number | null>(null);
  const [activatedAt, setActivatedAt] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const poll = async () => {
      const [statusResult, receiptResult, verdictResult] = await Promise.allSettled([
        fetchConsensusTransactionStatus(txHash),
        fetchConsensusTransactionReceipt(txHash),
        fetchVerdictRecord(claimHash),
      ]);

      if (cancelled) return;

      if (statusResult.status === "fulfilled") {
        setStatus(statusResult.value.status);
        setStatusCode(statusResult.value.statusCode);
        setRpcMessage(null);
        if (statusResult.value.status === TransactionStatus.UNINITIALIZED) {
          uninitializedStreakRef.current += 1;
        } else {
          uninitializedStreakRef.current = 0;
        }

        if (uninitializedStreakRef.current >= 3) {
          setRpcMessage(
            "Bradbury still does not recognize this transaction on the GenLayer side. This usually means the write reverted before consensus and should be resubmitted.",
          );
        }
      } else {
        setRpcMessage("Bradbury RPC is slow to answer. The court page is still polling.");
      }

      if (receiptResult.status === "fulfilled") {
        setPendingAt(receiptResult.value.pendingAt);
        setActivatedAt(receiptResult.value.activatedAt);
      }

      if (verdictResult.status === "fulfilled") {
        setVerdict(verdictResult.value);
        if (verdictResult.value) {
          setRecordDetected(true);
        }
      } else {
        setRpcMessage("Bradbury RPC is slow to answer. The court page is still polling.");
      }

      timer = setTimeout(poll, 4000);
    };

    void poll();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [claimHash, txHash]);

  const pendingForSeconds =
    pendingAt && pendingAt > 0 ? Math.max(0, Math.floor(Date.now() / 1000) - pendingAt) : null;
  const isStuckPending =
    status === TransactionStatus.PENDING &&
    pendingForSeconds !== null &&
    pendingForSeconds >= STUCK_PENDING_SECONDS &&
    (!activatedAt || activatedAt === 0);
  const copy = describePendingStatus(status, isStuckPending);
  const showResubmitAction =
    isStuckPending ||
    status === TransactionStatus.UNINITIALIZED ||
    status === TransactionStatus.CANCELED ||
    status === TransactionStatus.UNDETERMINED ||
    status === TransactionStatus.VALIDATORS_TIMEOUT ||
    status === TransactionStatus.LEADER_TIMEOUT;

  return (
    <article className="mx-auto max-w-prose space-y-section">
      <header>
        <p className="font-mono text-meta uppercase tracking-tracked text-ink-muted">
          Lemma · Pending record
        </p>
        <p className="mt-3 font-serif text-small italic text-ink-soft">
          This route is tracking the full Bradbury lifecycle for the submitted
          transaction. It stays on the process view even after the verdict
          record becomes readable.
        </p>
      </header>

      <section>
        <p className="editorial-label">Chain status</p>
        <h1 className="mt-4 font-serif text-h2 leading-tight text-ink">
          {copy.label}
        </h1>
        <p className="mt-4 font-serif text-lead leading-relaxed text-ink">
          {copy.body}
        </p>
      </section>

      <hr className="hairline" />

      <section className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <Field label="Expected claim hash">
          <span className="font-mono text-body break-all">{claimHash}</span>
        </Field>
        <Field label="Consensus transaction id">
          <span className="font-mono text-body break-all">{txHash}</span>
        </Field>
        <Field label="Observed stage">
          <span className="font-mono text-body lowercase">
            {status.toLowerCase().replace(/_/g, " ")}
          </span>
        </Field>
        <Field label="Status code">
          <span className="font-mono text-body">
            {statusCode === null ? "unknown" : statusCode}
          </span>
        </Field>
        <Field label="Readable record">
          <span className="font-mono text-body">
            {recordDetected ? "present" : "not yet"}
          </span>
        </Field>
        <Field label="Current verdict">
          <span className="font-mono text-body lowercase">
            {verdict?.label?.replace(/_/g, " ") ?? "not yet"}
          </span>
        </Field>
        <Field label="Where to look">
          <span className="font-serif text-small text-ink-soft">
            This hash is polled through Bradbury RPC. It will not necessarily resolve as a zkSync explorer transaction page.
          </span>
        </Field>
        <Field label="Queue age">
          <span className="font-mono text-body">
            {pendingForSeconds === null ? "unknown" : `${pendingForSeconds}s`}
          </span>
        </Field>
      </section>

      {rpcMessage && (
        <>
          <hr className="hairline" />
          <p className="font-serif text-small italic text-ink-muted">
            {rpcMessage}
          </p>
        </>
      )}

      <hr className="hairline-strong" />

      <section className="no-print flex flex-col gap-3">
        {verdict && (
          <p className="font-serif text-small text-ink-soft">
            The verdict record is already readable on Bradbury, but this page
            is continuing to show the lifecycle until the transaction reaches
            its terminal state.
          </p>
        )}
        {showResubmitAction && (
          <Link href="/submit" className="btn">
            Resubmit claim →
          </Link>
        )}
        {(status === TransactionStatus.FINALIZED || verdict?.settlement_status === "finalized") && (
          <Link href={`/v/${claimHash}`} className="btn">
            Open permanent record →
          </Link>
        )}
        <p className="font-serif text-small text-ink-soft">
          Reference: <span className="font-mono">lemma://verdict/{truncateHash(claimHash, 14, 10)}</span>
        </p>
      </section>
    </article>
  );
}

function describePendingStatus(status: ConsensusStage, isStuckPending: boolean): {
  label: string;
  body: string;
} {
  switch (status) {
    case "PENDING":
      if (isStuckPending) {
        return {
          label: "Still queued on Bradbury",
          body: "Bradbury has kept this claim in the pending queue without activating validator consensus. If your zkSync explorer submission shows failed or reverted, treat this attempt as unsuccessful and resubmit the claim.",
        };
      }
      return {
        label: "Queued on Bradbury",
        body: "Bradbury has accepted the claim into its queue. The network has not activated validator consensus yet.",
      };
    case "PROPOSING":
      return {
        label: "Leader proposing receipt",
        body: "A leader is preparing the proposed execution result for this claim. The record is not readable yet.",
      };
    case "COMMITTING":
      return {
        label: "Validators committing",
        body: "The jury is committing votes for the claim. This is the first consensus pass before reveals.",
      };
    case "REVEALING":
      return {
        label: "Validators revealing",
        body: "The jury is revealing votes. If the round agrees, the verdict will move to accepted next.",
      };
    case "ACCEPTED":
      return {
        label: "Accepted by the jury",
        body: "Bradbury accepted the claim. The verdict may already be readable, but the finalization window is still open.",
      };
    case "READY_TO_FINALIZE":
      return {
        label: "Accepted; finalization window open",
        body: "The verdict record is live, and Bradbury is now waiting for finalization of the same decision.",
      };
    case "FINALIZED":
      return {
        label: "Finalized by the jury",
        body: "Bradbury finalized the claim. The full process is complete, and the permanent record can now be opened separately.",
      };
    case "UNINITIALIZED":
      return {
        label: "Not registered in consensus yet",
        body: "Bradbury has not exposed this hash as a GenLayer transaction. If this state persists, the write likely reverted before entering consensus.",
      };
    case "CANCELED":
      return {
        label: "Consensus canceled",
        body: "Bradbury canceled this transaction before a verdict record was written.",
      };
    case "UNDETERMINED":
      return {
        label: "Consensus undetermined",
        body: "Bradbury did not produce a durable result for this transaction. The record did not settle cleanly.",
      };
    case "VALIDATORS_TIMEOUT":
    case "LEADER_TIMEOUT":
      return {
        label: "Consensus timed out",
        body: "The jury round timed out. The transaction exists, but the network did not finish this adjudication cycle.",
      };
    default:
      return {
        label: "Awaiting consensus",
        body: "The transaction is live on Bradbury and this page is polling for the current consensus stage.",
      };
  }
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="editorial-label">{label}</p>
      <p className="mt-2">{children}</p>
    </div>
  );
}
