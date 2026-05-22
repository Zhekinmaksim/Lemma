import { createHash } from "node:crypto";
import { createAccount, createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";
import {
  ExecutionResult,
  TransactionHashVariant,
  TransactionStatus,
} from "genlayer-js/types";
import {
  formatReadinessError,
  getTransactionStatus,
  inspectDeploymentReadiness,
} from "./bradbury-rpc.mjs";

const MIN_STAKE = 1_000_000_000_000_000n;
const FINALIZE_WAIT_ATTEMPTS = 24;
const WRITE_RETRY_ATTEMPTS = 3;
const WRITE_RETRY_DELAY_MS = 10000;
const contractAddress = requiredAddress(
  "NEXT_PUBLIC_LEMMA_CONTRACT",
  process.env.NEXT_PUBLIC_LEMMA_CONTRACT,
);
const writeSmoke = process.argv.includes("--write");
const privateKey = process.env.GENLAYER_PRIVATE_KEY?.trim();
const deployTx = process.env.LEMMA_DEPLOY_TX?.trim();

const account = privateKey ? createAccount(privateKey) : createAccount();
const client = createClient({
  account,
  chain: testnetBradbury,
});

console.log("Bradbury Lemma smoke test");
console.log(`Contract: ${contractAddress}`);

await readSmoke();

if (writeSmoke) {
  if (!privateKey) {
    throw new Error("Write smoke requires GENLAYER_PRIVATE_KEY in .env.local.");
  }
  await writeClaimSmoke();
}

async function readSmoke() {
  let stats;
  let recent;

  try {
    [stats, recent] = await Promise.all([
      client.readContract({
        address: contractAddress,
        functionName: "get_stats",
        args: [],
      }),
      client.readContract({
        address: contractAddress,
        functionName: "get_recent_claims",
        args: [5],
      }),
    ]);
  } catch (error) {
    await throwReadinessAwareError(error);
  }

  console.log("Read smoke passed");
  console.log(`Stats: ${JSON.stringify(stats)}`);
  console.log(`Recent claim hashes: ${JSON.stringify(recent)}`);
}

async function writeClaimSmoke() {
  const sourceUrl =
    "https://arxiv.org/abs/1706.03762?lemma_smoke=" + Date.now().toString();
  const claimText =
    "Attention Is All You Need introduces the Transformer architecture.";
  const sourceContext = "Bradbury deployment smoke test";
  const claimHash = computeClaimHash(claimText, sourceUrl, account.address);

  console.log("");
  console.log("Submitting paid write smoke");
  console.log(`Submitter: ${account.address}`);
  console.log(`Expected claim hash: ${claimHash}`);

  const txHash = await submitClaimWithRetry(claimText, sourceUrl, sourceContext);

  console.log(`Submit transaction: ${txHash}`);

  const acceptedReceipt = await client.waitForTransactionReceipt({
    hash: txHash,
    status: TransactionStatus.ACCEPTED,
    retries: 240,
    interval: 5000,
  });

  if (
    acceptedReceipt.txExecutionResultName !==
    ExecutionResult.FINISHED_WITH_RETURN
  ) {
    throw new Error(
      `Write smoke did not finish with a return value: ${acceptedReceipt.txExecutionResultName}. Inspect with: genlayer trace ${txHash}`,
    );
  }

  console.log("Transaction accepted");

  const acceptedVerdict = await readVerdict(claimHash, {
    transactionHashVariant: TransactionHashVariant.LATEST_NONFINAL,
  });
  console.log("Write smoke passed on accepted state");
  console.log(`Accepted verdict: ${JSON.stringify(acceptedVerdict)}`);

  const finalizationStatus = await waitUntilReadyToFinalize(
    txHash,
    FINALIZE_WAIT_ATTEMPTS,
  );

  if (finalizationStatus === "READY_TO_FINALIZE") {
    const finalizeHash = await client.finalizeTransaction({ txId: txHash });
    console.log(`Finalize transaction: ${finalizeHash}`);

    await client.waitForTransactionReceipt({
      hash: finalizeHash,
      retries: 240,
      interval: 5000,
    });

    const receipt = await client.waitForTransactionReceipt({
      hash: txHash,
      status: TransactionStatus.FINALIZED,
      retries: 240,
      interval: 5000,
    });

    const finalizedVerdict = await readVerdict(claimHash, {
      transactionHashVariant: TransactionHashVariant.LATEST_FINAL,
    });

    console.log("Write smoke finalized");
    console.log(`Finalized verdict: ${JSON.stringify(finalizedVerdict)}`);
    console.log(`Final status: ${receipt.statusName}`);
    return;
  }

  if (finalizationStatus === "FINALIZED") {
    const finalizedVerdict = await readVerdict(claimHash, {
      transactionHashVariant: TransactionHashVariant.LATEST_FINAL,
    });

    console.log("Write smoke already finalized");
    console.log(`Finalized verdict: ${JSON.stringify(finalizedVerdict)}`);
    return;
  }

  console.log(
    `Finalization window still open after ${FINALIZE_WAIT_ATTEMPTS * 5}s; accepted-state verification is complete.`,
  );
}

async function readVerdict(claimHash, options = {}) {
  let verdict;
  try {
    verdict = await client.readContract({
      address: contractAddress,
      functionName: "get_verdict",
      args: [claimHash],
      ...options,
    });
  } catch (error) {
    await throwReadinessAwareError(error);
  }
  return verdict;
}

async function submitClaimWithRetry(claimText, sourceUrl, sourceContext) {
  for (let attempt = 1; attempt <= WRITE_RETRY_ATTEMPTS; attempt += 1) {
    try {
      return await client.writeContract({
        address: contractAddress,
        functionName: "submit_claim",
        args: [claimText, sourceUrl, sourceContext],
        value: MIN_STAKE,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const canRetry =
        message.includes("Transaction reverted: EVM tx") &&
        attempt < WRITE_RETRY_ATTEMPTS;

      if (!canRetry) {
        throw error;
      }

      console.log(
        `Write submission reverted at consensus layer, retrying (${attempt}/${WRITE_RETRY_ATTEMPTS - 1})...`,
      );
      await sleep(WRITE_RETRY_DELAY_MS);
    }
  }

  throw new Error("Write submission retry loop exhausted unexpectedly.");
}

async function throwReadinessAwareError(error) {
  const message = error instanceof Error ? error.message : String(error);
  if (!message.includes("contract not found")) {
    throw error;
  }

  const readiness = await inspectDeploymentReadiness({
    txId: deployTx,
    address: contractAddress,
  });
  const readinessError = formatReadinessError(readiness);
  if (readinessError) {
    throw new Error(readinessError);
  }

  throw error;
}

function computeClaimHash(claimText, sourceUrl, submitter) {
  const hash = createHash("sha256");
  hash.update(claimText, "utf8");
  hash.update(Buffer.from([0]));
  hash.update(sourceUrl, "utf8");
  hash.update(Buffer.from([0]));
  hash.update(Buffer.from(submitter.slice(2), "hex"));
  return "0x" + hash.digest("hex");
}

function requiredAddress(name, value) {
  const trimmed = value?.trim();
  if (!trimmed || !/^0x[0-9a-fA-F]{40}$/.test(trimmed)) {
    throw new Error(`${name} must be a 0x-prefixed address in .env.local.`);
  }
  return trimmed;
}

async function waitUntilReadyToFinalize(txHash, maxAttempts) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const { status, statusCode } = await getTransactionStatus(txHash);

    if (status === "FINALIZED") {
      return status;
    }

    if (status === "READY_TO_FINALIZE") {
      console.log("Transaction ready to finalize");
      return status;
    }

    if (attempt === 1 || attempt % 6 === 0) {
      console.log(`Waiting for finalization window: ${status} (${statusCode})`);
    }

    await sleep(5000);
  }

  return "ACCEPTED";
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
