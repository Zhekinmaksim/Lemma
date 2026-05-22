import { testnetBradbury } from "genlayer-js/chains";

export const BRADBURY_RPC_URL = testnetBradbury.rpcUrls.default.http[0];

export async function rpc(method, params) {
  const response = await fetch(BRADBURY_RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method,
      params,
    }),
  });

  const payload = await response.json();
  if (payload.error) {
    throw new Error(`${method}: ${payload.error.message}`);
  }
  return payload.result;
}

export async function getSyncStatus() {
  return rpc("gen_syncing", []);
}

export async function getTransactionStatus(txId) {
  return rpc("gen_getTransactionStatus", [{ txId }]);
}

export async function getTransactionReceipt(txId) {
  return rpc("gen_getTransactionReceipt", [{ txId }]);
}

export async function getContractCode(address, request = {}) {
  return rpc("gen_getContractCode", [{ address, ...request }]);
}

export async function getContractState(address, request = {}) {
  return rpc("gen_getContractState", [{ address, ...request }]);
}

export async function inspectDeploymentReadiness({ txId, address }) {
  const receipt = txId ? await getTransactionReceipt(txId) : null;
  const resolvedAddress = receipt?.recipient ?? address ?? null;
  const deploymentBlock =
    receipt?.readStateBlockRanges?.[0]?.ProposalBlock ??
    receipt?.readStateBlockRanges?.[0]?.ProcessingBlock ??
    receipt?.readStateBlockRanges?.[0]?.ActivationBlock ??
    null;

  const [sync, codeProbe, stateProbe] = await Promise.all([
    getSyncStatus().catch((error) => ({ error: error.message })),
    resolvedAddress
      ? getContractCode(resolvedAddress, { status: "finalized" })
          .then(() => ({ ok: true }))
          .catch((error) => ({ ok: false, error: error.message }))
      : Promise.resolve({ ok: false, error: "No contract address resolved." }),
    resolvedAddress
      ? getContractState(resolvedAddress, { status: "finalized" })
          .then(() => ({ ok: true }))
          .catch((error) => ({ ok: false, error: error.message }))
      : Promise.resolve({ ok: false, error: "No contract address resolved." }),
  ]);

  const syncedBlock = parseBlockNumber(sync?.syncedBlock);
  const latestBlock = parseBlockNumber(sync?.latestBlock);
  const targetBlock = parseBlockNumber(deploymentBlock);

  const syncGapToHead =
    syncedBlock !== null && latestBlock !== null ? latestBlock - syncedBlock : null;
  const syncGapToDeployment =
    syncedBlock !== null && targetBlock !== null ? targetBlock - syncedBlock : null;

  return {
    address: resolvedAddress,
    receipt,
    sync,
    codeProbe,
    stateProbe,
    deploymentBlock,
    syncGapToHead,
    syncGapToDeployment,
  };
}

export function formatReadinessError(report) {
  if (!report.address) {
    return "Bradbury finalized the transaction, but no contract address could be resolved.";
  }

  if (report.codeProbe.ok && report.stateProbe.ok) {
    return null;
  }

  if (typeof report.syncGapToDeployment === "number" && report.syncGapToDeployment > 0) {
    return (
      "Bradbury finalized the deployment, but its GenVM read surface is not caught up yet. " +
      `Deployment block ${report.deploymentBlock} is ${report.syncGapToDeployment} blocks ahead ` +
      `of the node's synced GenVM block ${report.sync?.syncedBlock}.`
    );
  }

  if (typeof report.syncGapToHead === "number" && report.syncGapToHead > 0) {
    return (
      "Bradbury finalized the deployment, but the node is still syncing GenVM state. " +
      `Current lag: ${report.syncGapToHead} blocks behind head.`
    );
  }

  return (
    "Bradbury finalized the deployment, but contract code/state lookups still fail for the " +
    `resolved address ${report.address}.`
  );
}

function parseBlockNumber(value) {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    if (value.startsWith("0x")) return Number.parseInt(value, 16);
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}
