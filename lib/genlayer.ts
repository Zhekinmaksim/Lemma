/**
 * GenLayer client wrapper.
 *
 * Centralises every call to the genlayer-js SDK so the rest of the
 * frontend never imports it directly. Two surfaces:
 *
 *   1. Read clients (no signing): used by server components and by
 *      client components for view methods.
 *   2. Write clients (browser only, MetaMask-driven): created on
 *      demand from a connected EOA address.
 *
 * The contract address is read from NEXT_PUBLIC_LEMMA_CONTRACT. If it
 * is missing, all entry points throw ContractNotDeployedError which
 * the UI catches and renders as an editorial "court not in session"
 * message.
 */

import { createClient, createAccount } from "genlayer-js";
import { testnetBradbury, studionet, localnet } from "genlayer-js/chains";
import { TransactionHashVariant, TransactionStatus } from "genlayer-js/types";
import { getAddress } from "viem";
import type { Hash } from "viem";
import type {
  Verdict,
  LemmaStats,
  VerdictSettlementStatus,
} from "./abi";
import { LEMMA_METHODS } from "./abi";

// ---------------------------------------------------------------------------
// Chain selection
// ---------------------------------------------------------------------------

function resolveChain() {
  const target = (process.env.NEXT_PUBLIC_GENLAYER_CHAIN ?? "bradbury").toLowerCase();
  if (target === "studio" || target === "studionet") return studionet;
  if (target === "local" || target === "localnet") return localnet;
  return testnetBradbury;
}

function resolveNetworkName(): "localnet" | "studionet" | "testnetBradbury" {
  const target = (process.env.NEXT_PUBLIC_GENLAYER_CHAIN ?? "bradbury").toLowerCase();
  if (target === "studio" || target === "studionet") return "studionet";
  if (target === "local" || target === "localnet") return "localnet";
  return "testnetBradbury";
}

const chain = resolveChain();
const networkName = resolveNetworkName();

interface ReadOptions {
  transactionHashVariant?: TransactionHashVariant;
}

const DEFAULT_READ_OPTIONS: ReadOptions = {
  transactionHashVariant: TransactionHashVariant.LATEST_NONFINAL,
};

const STATUS_CODE_TO_NAME: Record<number, TransactionStatus> = {
  0: TransactionStatus.UNINITIALIZED,
  1: TransactionStatus.PENDING,
  2: TransactionStatus.PROPOSING,
  3: TransactionStatus.COMMITTING,
  4: TransactionStatus.REVEALING,
  5: TransactionStatus.ACCEPTED,
  6: TransactionStatus.UNDETERMINED,
  7: TransactionStatus.FINALIZED,
  8: TransactionStatus.CANCELED,
  9: TransactionStatus.APPEAL_REVEALING,
  10: TransactionStatus.APPEAL_COMMITTING,
  11: TransactionStatus.READY_TO_FINALIZE,
  12: TransactionStatus.VALIDATORS_TIMEOUT,
  13: TransactionStatus.LEADER_TIMEOUT,
};

const TERMINAL_FAILURE_STATUSES = new Set<TransactionStatus>([
  TransactionStatus.CANCELED,
  TransactionStatus.UNDETERMINED,
  TransactionStatus.VALIDATORS_TIMEOUT,
  TransactionStatus.LEADER_TIMEOUT,
]);

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class ContractNotDeployedError extends Error {
  constructor() {
    super("Lemma contract address not configured.");
    this.name = "ContractNotDeployedError";
  }
}

export class WalletNotConnectedError extends Error {
  constructor() {
    super("A wallet must be connected to perform this action.");
    this.name = "WalletNotConnectedError";
  }
}

// ---------------------------------------------------------------------------
// Contract address
// ---------------------------------------------------------------------------

type Address0x = `0x${string}`;

function normaliseConfiguredAddress(raw: string | undefined): Address0x | null {
  const trimmed = raw?.trim();
  if (!trimmed || !/^0x[0-9a-fA-F]{40}$/.test(trimmed)) {
    return null;
  }

  try {
    // Accept env values even if they were pasted with the wrong checksum
    // casing; viem returns the canonical checksummed representation.
    return getAddress(trimmed.toLowerCase()) as Address0x;
  } catch {
    return null;
  }
}

export function getContractAddress(): Address0x {
  const address = normaliseConfiguredAddress(process.env.NEXT_PUBLIC_LEMMA_CONTRACT);
  if (!address) {
    throw new ContractNotDeployedError();
  }
  return address;
}

export function isContractConfigured(): boolean {
  return normaliseConfiguredAddress(process.env.NEXT_PUBLIC_LEMMA_CONTRACT) !== null;
}

// ---------------------------------------------------------------------------
// Read client (no signer)
// ---------------------------------------------------------------------------

function readClient() {
  const ephemeral = createAccount();
  return createClient({
    chain,
    account: ephemeral,
  });
}

// ---------------------------------------------------------------------------
// Read methods
// ---------------------------------------------------------------------------

export async function fetchStats(
  options: ReadOptions = DEFAULT_READ_OPTIONS,
): Promise<LemmaStats> {
  const client = readClient();
  const address = getContractAddress();
  const result = await client.readContract({
    address,
    functionName: LEMMA_METHODS.getStats,
    args: [],
    transactionHashVariant: options.transactionHashVariant,
  });
  return normaliseStats(result as unknown as Record<string, unknown>);
}

export async function fetchRecentClaimHashes(
  limit = 20,
  options: ReadOptions = DEFAULT_READ_OPTIONS,
): Promise<string[]> {
  const client = readClient();
  const address = getContractAddress();
  const result = await client.readContract({
    address,
    functionName: LEMMA_METHODS.getRecentClaims,
    args: [limit],
    transactionHashVariant: options.transactionHashVariant,
  });
  return Array.isArray(result) ? (result as string[]) : [];
}

export async function fetchVerdict(
  claimHash: string,
  options: ReadOptions = DEFAULT_READ_OPTIONS,
): Promise<Verdict | null> {
  if (!claimHash || !claimHash.startsWith("0x")) return null;
  const client = readClient();
  const address = getContractAddress();
  try {
    const result = await client.readContract({
      address,
      functionName: LEMMA_METHODS.getVerdict,
      args: [claimHash],
      transactionHashVariant: options.transactionHashVariant,
    });
    return normaliseVerdict(result as unknown as Record<string, unknown>);
  } catch {
    // The contract reverts with UserError for unknown claim_hash. The
    // SDK surfaces this as a thrown call exception; callers expect null.
    return null;
  }
}

export async function fetchRecentVerdicts(limit = 20): Promise<Verdict[]> {
  const [acceptedHashes, finalizedHashes] = await Promise.all([
    fetchRecentClaimHashes(limit, {
      transactionHashVariant: TransactionHashVariant.LATEST_NONFINAL,
    }),
    fetchRecentClaimHashes(limit, {
      transactionHashVariant: TransactionHashVariant.LATEST_FINAL,
    }),
  ]);
  const finalizedSet = new Set(finalizedHashes);
  const results = await Promise.all(
    acceptedHashes.map(async (hash) => {
      const verdict = await fetchVerdict(hash, {
        transactionHashVariant: TransactionHashVariant.LATEST_NONFINAL,
      });
      if (!verdict) return null;
      return {
        ...verdict,
        settlement_status: finalizedSet.has(hash) ? "finalized" : "accepted",
      } satisfies Verdict;
    }),
  );
  const verdicts: Verdict[] = [];
  for (const verdict of results) {
    if (verdict) verdicts.push(verdict);
  }
  return verdicts;
}

export async function fetchVerdictRecord(claimHash: string): Promise<Verdict | null> {
  const [acceptedVerdict, finalizedVerdict] = await Promise.all([
    fetchVerdict(claimHash, {
      transactionHashVariant: TransactionHashVariant.LATEST_NONFINAL,
    }),
    fetchVerdict(claimHash, {
      transactionHashVariant: TransactionHashVariant.LATEST_FINAL,
    }),
  ]);

  if (!acceptedVerdict) return null;

  return {
    ...acceptedVerdict,
    settlement_status: finalizedVerdict ? "finalized" : "accepted",
  };
}

export async function fetchStatsSnapshot(): Promise<{
  accepted: LemmaStats;
  finalized: LemmaStats;
}> {
  const [accepted, finalized] = await Promise.all([
    fetchStats({
      transactionHashVariant: TransactionHashVariant.LATEST_NONFINAL,
    }),
    fetchStats({
      transactionHashVariant: TransactionHashVariant.LATEST_FINAL,
    }),
  ]);
  return { accepted, finalized };
}

// ---------------------------------------------------------------------------
// Write methods
// ---------------------------------------------------------------------------

function writeClient(account: Address0x) {
  if (!account) throw new WalletNotConnectedError();
  const provider = getEthereumProvider();

  return createClient({
    chain,
    // MetaMask-driven signing: passing the address tells the SDK to
    // delegate eth_sendTransaction to window.ethereum.
    account,
    provider,
  });
}

export interface SubmitClaimInput {
  account: Address0x;
  claimText: string;
  sourceUrl: string;
  sourceContext: string;
  stake: bigint;
}

export interface SubmitClaimResult {
  txHash: Hash;
  claimHash: string;
  settlementStatus: VerdictSettlementStatus;
  verdict: Verdict;
}

export interface TransactionLifecycleUpdate {
  txHash: Hash;
  lifecycle: "submitted" | "accepted" | "finalized";
  consensusStatus: TransactionStatus | "UNKNOWN";
  statusCode: number | null;
}

export interface WatchConsensusTransactionSnapshot<T = unknown> {
  txHash: Hash;
  status: TransactionStatus | "UNKNOWN";
  statusCode: number | null;
  accepted: boolean;
  finalized: boolean;
  readyToFinalize: boolean;
  value: T | null;
}

interface WatchConsensusTransactionOptions<T> {
  account?: Address0x;
  intervalMs?: number;
  timeoutMs?: number;
  readValue?: () => Promise<T | null>;
  isDone?: (snapshot: WatchConsensusTransactionSnapshot<T>) => boolean;
  onUpdate?: (snapshot: WatchConsensusTransactionSnapshot<T>) => void;
}

interface SubmitClaimOptions {
  onStatusChange?: (update: TransactionLifecycleUpdate) => void;
}

export async function submitClaim(
  input: SubmitClaimInput,
  options: SubmitClaimOptions = {},
): Promise<SubmitClaimResult> {
  const client = writeClient(input.account);
  const address = getContractAddress();
  const expectedClaimHash = await computeClaimHash(
    input.claimText,
    input.sourceUrl,
    input.account,
  );

  let txHash: Hash;
  try {
    await ensureWalletOnConfiguredNetwork(client);
    txHash = await client.writeContract({
      address,
      functionName: LEMMA_METHODS.submitClaim,
      args: [input.claimText, input.sourceUrl, input.sourceContext],
      value: input.stake,
    });
  } catch (error) {
    throw normaliseWriteError(error);
  }

  options.onStatusChange?.({
    txHash,
    lifecycle: "submitted",
    consensusStatus: TransactionStatus.PENDING,
    statusCode: 1,
  });

  const snapshot = await watchConsensusTransaction<Verdict>(txHash, {
    account: input.account,
    readValue: async () => {
      const verdict = await fetchVerdict(expectedClaimHash, {
        transactionHashVariant: TransactionHashVariant.LATEST_NONFINAL,
      });
      if (!verdict) return null;
      return {
        ...verdict,
        settlement_status: "accepted",
      };
    },
    isDone: (state) => state.accepted && state.value !== null,
    onUpdate: (state) => {
      if (state.accepted) {
        options.onStatusChange?.({
          txHash,
          lifecycle: state.finalized ? "finalized" : "accepted",
          consensusStatus: state.status,
          statusCode: state.statusCode,
        });
      }
    },
  });

  if (!snapshot.value) {
    throw new Error("Bradbury accepted the claim, but the verdict record is not readable yet.");
  }

  const settlementStatus: VerdictSettlementStatus = snapshot.finalized
    ? "finalized"
    : "accepted";

  return {
    txHash,
    claimHash: expectedClaimHash,
    settlementStatus,
    verdict: {
      ...snapshot.value,
      settlement_status: settlementStatus,
    },
  };
}

export interface AppealInput {
  account: Address0x;
  claimHash: string;
  stake: bigint;
  previousAppealCount: number;
}

export interface AppealVerdictResult {
  txHash: Hash;
  settlementStatus: VerdictSettlementStatus;
  verdict: Verdict;
}

interface AppealVerdictOptions {
  onStatusChange?: (update: TransactionLifecycleUpdate) => void;
}

export async function appealVerdict(
  input: AppealInput,
  options: AppealVerdictOptions = {},
): Promise<AppealVerdictResult> {
  const client = writeClient(input.account);
  const address = getContractAddress();
  let txHash: Hash;
  try {
    await ensureWalletOnConfiguredNetwork(client);
    txHash = await client.writeContract({
      address,
      functionName: LEMMA_METHODS.appeal,
      args: [input.claimHash],
      value: input.stake,
    });
  } catch (error) {
    throw normaliseWriteError(error);
  }

  options.onStatusChange?.({
    txHash,
    lifecycle: "submitted",
    consensusStatus: TransactionStatus.PENDING,
    statusCode: 1,
  });

  const snapshot = await watchConsensusTransaction<Verdict>(txHash, {
    account: input.account,
    readValue: async () => {
      const verdict = await fetchVerdict(input.claimHash, {
        transactionHashVariant: TransactionHashVariant.LATEST_NONFINAL,
      });
      if (!verdict) return null;
      return {
        ...verdict,
        settlement_status: "accepted",
      };
    },
    isDone: (state) =>
      state.accepted &&
      state.value !== null &&
      state.value.appeal_count > input.previousAppealCount,
    onUpdate: (state) => {
      if (state.accepted) {
        options.onStatusChange?.({
          txHash,
          lifecycle: state.finalized ? "finalized" : "accepted",
          consensusStatus: state.status,
          statusCode: state.statusCode,
        });
      }
    },
  });

  if (!snapshot.value) {
    throw new Error("Bradbury accepted the appeal, but the updated verdict is not readable yet.");
  }

  const settlementStatus: VerdictSettlementStatus = snapshot.finalized
    ? "finalized"
    : "accepted";

  return {
    txHash,
    settlementStatus,
    verdict: {
      ...snapshot.value,
      settlement_status: settlementStatus,
    },
  };
}

// ---------------------------------------------------------------------------
// Normalisation helpers
// ---------------------------------------------------------------------------

function normaliseVerdict(raw: Record<string, unknown>): Verdict {
  return {
    claim_hash: String(raw.claim_hash ?? ""),
    claim_text: String(raw.claim_text ?? ""),
    source_url: String(raw.source_url ?? ""),
    source_context: String(raw.source_context ?? ""),
    submitter: String(raw.submitter ?? ""),
    label: (raw.label as Verdict["label"]) ?? "unverifiable",
    justification: String(raw.justification ?? ""),
    sequence: toNumber(raw.sequence),
    appeal_count: toNumber(raw.appeal_count),
    stake_consumed: toNumber(raw.stake_consumed),
  };
}

function normaliseStats(raw: Record<string, unknown>): LemmaStats {
  return {
    total_claims: toNumber(raw.total_claims),
    verified: toNumber(raw.verified),
    partially_verified: toNumber(raw.partially_verified),
    misrepresented: toNumber(raw.misrepresented),
    unsupported: toNumber(raw.unsupported),
    unverifiable: toNumber(raw.unverifiable),
    min_stake: toNumber(raw.min_stake),
    appeal_multiplier: toNumber(raw.appeal_multiplier),
  };
}

function toNumber(value: unknown): number {
  if (typeof value === "number") return value;
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

export async function watchConsensusTransaction<T = unknown>(
  txHash: Hash,
  options: WatchConsensusTransactionOptions<T> = {},
): Promise<WatchConsensusTransactionSnapshot<T>> {
  const client = options.account ? writeClient(options.account) : readClient();
  const intervalMs = options.intervalMs ?? 5000;
  const timeoutMs = options.timeoutMs ?? 5 * 60 * 1000;
  const deadline = Date.now() + timeoutMs;

  let lastStatus: TransactionStatus | "UNKNOWN" | null = null;
  let hasEmittedValue = false;
  let lastSnapshot: WatchConsensusTransactionSnapshot<T> | null = null;

  while (Date.now() < deadline) {
    const statusSnapshot = await getConsensusTransactionStatus(client, txHash);
    let value: T | null = null;

    if (statusSnapshot.accepted && options.readValue) {
      try {
        value = await options.readValue();
      } catch {
        value = null;
      }
    }

    const snapshot: WatchConsensusTransactionSnapshot<T> = {
      ...statusSnapshot,
      value,
    };
    lastSnapshot = snapshot;

    const shouldEmit =
      snapshot.status !== lastStatus || (value !== null && !hasEmittedValue);
    if (shouldEmit) {
      options.onUpdate?.(snapshot);
      lastStatus = snapshot.status;
      if (value !== null) hasEmittedValue = true;
    }

    if (
      TERMINAL_FAILURE_STATUSES.has(snapshot.status as TransactionStatus)
    ) {
      throw new Error(
        `Bradbury transaction ${txHash} ended in ${humanizeTransactionStatus(snapshot.status)}.`,
      );
    }

    if (options.isDone ? options.isDone(snapshot) : snapshot.finalized) {
      return snapshot;
    }

    await delay(intervalMs);
  }

  throw new Error(
    `Timed out waiting for Bradbury transaction ${txHash}. Last observed status: ${humanizeTransactionStatus(
      lastSnapshot?.status ?? "UNKNOWN",
    )}.`,
  );
}

async function getConsensusTransactionStatus(
  client: ReturnType<typeof createClient>,
  txHash: Hash,
): Promise<Omit<WatchConsensusTransactionSnapshot<never>, "value">> {
  const raw = (await (client as { request: (args: unknown) => Promise<unknown> }).request({
    method: "gen_getTransactionStatus",
    params: [{ txId: txHash }],
  })) as { status?: unknown; statusCode?: unknown };

  const status = normaliseTransactionStatus(raw.status, raw.statusCode);
  const statusCode = typeof raw.statusCode === "number" ? raw.statusCode : toNumber(raw.statusCode);

  return {
    txHash,
    status,
    statusCode: Number.isFinite(statusCode) ? statusCode : null,
    accepted:
      status === TransactionStatus.ACCEPTED ||
      status === TransactionStatus.READY_TO_FINALIZE ||
      status === TransactionStatus.FINALIZED,
    finalized: status === TransactionStatus.FINALIZED,
    readyToFinalize: status === TransactionStatus.READY_TO_FINALIZE,
  };
}

function normaliseTransactionStatus(
  status: unknown,
  statusCode: unknown,
): TransactionStatus | "UNKNOWN" {
  if (typeof statusCode === "number" && STATUS_CODE_TO_NAME[statusCode] !== undefined) {
    return STATUS_CODE_TO_NAME[statusCode];
  }

  if (typeof status === "string") {
    const canonical = status.trim().replace(/[\s-]+/g, "_").toUpperCase();
    const matched = Object.values(TransactionStatus).find(
      (value) => value === canonical,
    );
    if (matched) return matched;
  }

  return "UNKNOWN";
}

function humanizeTransactionStatus(status: TransactionStatus | "UNKNOWN"): string {
  return status === "UNKNOWN" ? "unknown state" : status.toLowerCase().replace(/_/g, " ");
}

async function ensureWalletOnConfiguredNetwork(
  client: ReturnType<typeof createClient>,
): Promise<void> {
  const provider = getEthereumProvider();
  if (!provider) {
    throw new Error("No Ethereum-compatible wallet detected.");
  }

  const targetChainIdHex = `0x${chain.id.toString(16)}`;
  const currentChainId = await provider.request({ method: "eth_chainId" });

  if (currentChainId !== targetChainIdHex) {
    try {
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: targetChainIdHex }],
      });
    } catch (error) {
      if (isChainNotAddedError(error)) {
        await provider.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: targetChainIdHex,
              chainName: chain.name,
              rpcUrls: chain.rpcUrls.default.http,
              nativeCurrency: chain.nativeCurrency,
              blockExplorerUrls: chain.blockExplorers?.default?.url
                ? [chain.blockExplorers.default.url]
                : undefined,
            },
          ],
        });
        await provider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: targetChainIdHex }],
        });
      } else {
        throw error;
      }
    }
  }

  await ensureGenLayerSnapInstalled(provider);
  client.chain = chain;
}

function normaliseWriteError(error: unknown): Error {
  if (error instanceof ContractNotDeployedError || error instanceof WalletNotConnectedError) {
    return error;
  }

  const message = extractErrorText(error);
  const lower = message.toLowerCase();

  if (lower.includes("wallet is on chain") && lower.includes("configured for chain")) {
    return new Error(
      "Your wallet is on the wrong network. Switch it to GenLayer Bradbury Testnet and try again.",
    );
  }

  if (
    lower.includes("wallet_getsnaps") ||
    lower.includes("wallet_requestsnaps") ||
    lower.includes("provider does not support the requested method") ||
    lower.includes("the provider does not support the requested method")
  ) {
    return new Error(
      "Your current wallet does not support the GenLayer Snap flow. Use MetaMask on desktop and approve the GenLayer Snap installation for Bradbury.",
    );
  }

  if (
    lower.includes("snap") &&
    (lower.includes("rejected") ||
      lower.includes("denied") ||
      lower.includes("refused") ||
      lower.includes("cancelled") ||
      lower.includes("canceled"))
  ) {
    return new Error(
      "The GenLayer Snap request was canceled. Open MetaMask again and approve the Snap installation to send Bradbury transactions.",
    );
  }

  if (
    (lower.includes("wallet_switchethereumchain") ||
      lower.includes("wallet_addethereumchain") ||
      lower.includes("switch chain")) &&
    (lower.includes("rejected") ||
      lower.includes("denied") ||
      lower.includes("refused") ||
      lower.includes("cancelled") ||
      lower.includes("canceled"))
  ) {
    return new Error(
      "The network switch was canceled. Approve the switch to GenLayer Bradbury Testnet and try again.",
    );
  }

  if (
    lower.includes("rejected") ||
    lower.includes("denied") ||
    lower.includes("user refused") ||
    lower.includes("user cancelled")
  ) {
    return new Error("The wallet request was canceled before the transaction was sent.");
  }

  if (lower.includes("unknown rpc error")) {
    return new Error(`The wallet or RPC rejected the transaction. Details: ${message}`);
  }

  return new Error(message);
}

function extractErrorText(error: unknown): string {
  const parts: string[] = [];
  const seen = new WeakSet<object>();

  function visit(value: unknown): void {
    if (value == null) return;

    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed) parts.push(trimmed);
      return;
    }

    if (typeof value !== "object") return;
    if (seen.has(value)) return;
    seen.add(value);

    const candidate = value as {
      shortMessage?: unknown;
      details?: unknown;
      message?: unknown;
      reason?: unknown;
      cause?: unknown;
      data?: unknown;
      code?: unknown;
    };

    visit(candidate.shortMessage);
    visit(candidate.details);
    visit(candidate.message);
    visit(candidate.reason);

    if (candidate.data && typeof candidate.data === "object") {
      const data = candidate.data as Record<string, unknown>;
      visit(data.message);
      visit(data.details);
      visit(data.reason);
    }

    visit(candidate.cause);
  }

  visit(error);

  const collapsed = parts
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  return collapsed || "Unknown transaction error.";
}

function getEthereumProvider():
  | { request: (args: { method: string; params?: unknown[] | Record<string, unknown> }) => Promise<unknown> }
  | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as typeof window & {
    ethereum?: {
      request: (args: {
        method: string;
        params?: unknown[] | Record<string, unknown>;
      }) => Promise<unknown>;
    };
  }).ethereum;
}

function isChainNotAddedError(error: unknown): boolean {
  const code =
    typeof error === "object" && error !== null && "code" in error
      ? Number((error as { code?: unknown }).code)
      : Number.NaN;

  if (code === 4902) return true;

  const message = extractErrorText(error).toLowerCase();
  return (
    message.includes("4902") ||
    message.includes("unrecognized chain id") ||
    message.includes("unknown chain") ||
    message.includes("chain not added")
  );
}

async function ensureGenLayerSnapInstalled(
  provider: NonNullable<ReturnType<typeof getEthereumProvider>>,
): Promise<void> {
  const snapId = "npm:genlayer-wallet-plugin";
  const installedSnaps = (await provider.request({
    method: "wallet_getSnaps",
  })) as Record<string, { id?: string }>;

  const isInstalled = Object.values(installedSnaps ?? {}).some(
    (snap) => snap?.id === snapId,
  );

  if (isInstalled) return;

  await provider.request({
    method: "wallet_requestSnaps",
    params: {
      [snapId]: {},
    },
  });
}

async function computeClaimHash(
  claimText: string,
  sourceUrl: string,
  submitter: Address0x,
): Promise<string> {
  const encoder = new TextEncoder();
  const claimBytes = encoder.encode(claimText);
  const sourceBytes = encoder.encode(sourceUrl);
  const submitterBytes = hexToBytes(submitter);
  const payload = new Uint8Array(
    claimBytes.length + 1 + sourceBytes.length + 1 + submitterBytes.length,
  );

  let offset = 0;
  payload.set(claimBytes, offset);
  offset += claimBytes.length;
  payload[offset] = 0;
  offset += 1;
  payload.set(sourceBytes, offset);
  offset += sourceBytes.length;
  payload[offset] = 0;
  offset += 1;
  payload.set(submitterBytes, offset);

  const digest = await globalThis.crypto.subtle.digest("SHA-256", payload);
  return `0x${bytesToHex(new Uint8Array(digest))}`;
}

function hexToBytes(value: string): Uint8Array {
  const normalized = value.startsWith("0x") ? value.slice(2) : value;
  const bytes = new Uint8Array(normalized.length / 2);
  for (let i = 0; i < normalized.length; i += 2) {
    bytes[i / 2] = Number.parseInt(normalized.slice(i, i + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
