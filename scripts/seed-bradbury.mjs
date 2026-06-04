import { createHash } from "node:crypto";
import { createAccount, createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";
import {
  ExecutionResult,
  TransactionHashVariant,
  TransactionStatus,
} from "genlayer-js/types";

const MIN_STAKE = 1_000_000_000_000_000n;
const WRITE_RETRY_ATTEMPTS = 3;
const WRITE_RETRY_DELAY_MS = 10_000;
const READ_RETRY_ATTEMPTS = 24;
const READ_RETRY_DELAY_MS = 5_000;

const contractAddress = requiredAddress(
  "NEXT_PUBLIC_LEMMA_CONTRACT",
  process.env.NEXT_PUBLIC_LEMMA_CONTRACT,
);
const privateKey = process.env.GENLAYER_PRIVATE_KEY?.trim();

if (!privateKey || !/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
  throw new Error("GENLAYER_PRIVATE_KEY must be a 0x-prefixed private key in .env.local.");
}

const account = createAccount(privateKey);
const client = createClient({
  account,
  chain: testnetBradbury,
});

const claims = [
  {
    claimText:
      "Attention Is All You Need proposes the Transformer, a model based solely on attention mechanisms, dispensing with recurrence and convolutions entirely.",
    sourceUrl: "https://arxiv.org/abs/1706.03762",
    sourceContext: "Abstract",
  },
  {
    claimText:
      "BERT is pre-trained using a masked language model objective and a next sentence prediction objective.",
    sourceUrl: "https://arxiv.org/abs/1810.04805",
    sourceContext: "Abstract",
  },
  {
    claimText:
      "CLIP learns visual concepts from natural language supervision.",
    sourceUrl: "https://arxiv.org/abs/2103.00020",
    sourceContext: "Abstract",
  },
  {
    claimText:
      "LoRA reduces the number of trainable parameters by learning low-rank updates instead of fine-tuning all model weights.",
    sourceUrl: "https://arxiv.org/abs/2106.09685",
    sourceContext: "Abstract",
  },
  {
    claimText:
      "Attention Is All You Need demonstrated a 15% reduction in training costs compared with recurrent models.",
    sourceUrl: "https://arxiv.org/abs/1706.03762",
    sourceContext: "Abstract",
  },
];

console.log("Seeding fresh Lemma contract on Bradbury");
console.log(`Contract: ${contractAddress}`);
console.log(`Submitter: ${account.address}`);

for (let index = 0; index < claims.length; index += 1) {
  const claim = claims[index];
  console.log("");
  console.log(`[${index + 1}/${claims.length}] ${claim.claimText}`);

  const txHash = await submitClaimWithRetry(claim);
  console.log(`Submit tx: ${txHash}`);

  const receipt = await client.waitForTransactionReceipt({
    hash: txHash,
    status: TransactionStatus.ACCEPTED,
    retries: 240,
    interval: 5000,
  });

  if (
    receipt.txExecutionResultName !==
    ExecutionResult.FINISHED_WITH_RETURN
  ) {
    throw new Error(
      `Claim ${index + 1} did not finish with return value: ${receipt.txExecutionResultName}`,
    );
  }

  const claimHash = computeClaimHash(
    claim.claimText,
    claim.sourceUrl,
    account.address,
  );
  const verdict = await waitForReadableVerdict(claimHash);

  console.log(`Claim hash: ${claimHash}`);
  console.log(`Verdict: ${verdict.label}`);
}

console.log("");
console.log("Seed complete");

async function submitClaimWithRetry(claim) {
  for (let attempt = 1; attempt <= WRITE_RETRY_ATTEMPTS; attempt += 1) {
    try {
      return await client.writeContract({
        address: contractAddress,
        functionName: "submit_claim",
        args: [claim.claimText, claim.sourceUrl, claim.sourceContext],
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
        `Transient consensus-layer revert, retrying (${attempt}/${WRITE_RETRY_ATTEMPTS - 1})...`,
      );
      await sleep(WRITE_RETRY_DELAY_MS);
    }
  }

  throw new Error("Write retry loop exhausted unexpectedly.");
}

async function waitForReadableVerdict(claimHash) {
  for (let attempt = 1; attempt <= READ_RETRY_ATTEMPTS; attempt += 1) {
    try {
      return await client.readContract({
        address: contractAddress,
        functionName: "get_verdict",
        args: [claimHash],
        transactionHashVariant: TransactionHashVariant.LATEST_NONFINAL,
      });
    } catch (error) {
      if (attempt === READ_RETRY_ATTEMPTS) {
        throw error;
      }
      await sleep(READ_RETRY_DELAY_MS);
    }
  }

  throw new Error(`Verdict ${claimHash} did not become readable.`);
}

function requiredAddress(name, value) {
  const trimmed = value?.trim();
  if (!trimmed || !/^0x[0-9a-fA-F]{40}$/.test(trimmed)) {
    throw new Error(`${name} must be a 0x-prefixed address in .env.local.`);
  }
  return trimmed;
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

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
