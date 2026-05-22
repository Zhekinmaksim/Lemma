import { readFileSync } from "node:fs";
import { createAccount, createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";
import { ExecutionResult, TransactionStatus } from "genlayer-js/types";
import {
  formatReadinessError,
  inspectDeploymentReadiness,
} from "./bradbury-rpc.mjs";

const privateKey = requiredPrivateKey();
const account = createAccount(privateKey);
const client = createClient({
  account,
  chain: testnetBradbury,
});

const contractCode = new Uint8Array(
  readFileSync(new URL("../lemma.py", import.meta.url)),
);

console.log("Deploying Lemma to Bradbury");
console.log(`Deployer: ${account.address}`);

const txHash = await client.deployContract({
  code: contractCode,
  args: [],
});

console.log(`Deployment transaction: ${txHash}`);

const receipt = await client.waitForTransactionReceipt({
  hash: txHash,
  status: TransactionStatus.FINALIZED,
  retries: 200,
  interval: 5000,
});

if (receipt.txExecutionResultName === ExecutionResult.FINISHED_WITH_ERROR) {
  throw new Error(
    `Deployment execution failed. Inspect with: genlayer trace ${txHash}`,
  );
}

const readiness = await inspectDeploymentReadiness({
  txId: txHash,
  address:
    receipt.data?.contract_address ?? receipt.txDataDecoded?.contractAddress,
});
const contractAddress = readiness.address;

if (!contractAddress) {
  throw new Error(
    `Bradbury accepted deployment ${txHash}, but no contract address was decoded.`,
  );
}

console.log("");
console.log("Lemma deployed");
console.log(`Contract address: ${contractAddress}`);
console.log(`Deployment tx: ${txHash}`);
console.log("");
console.log("Add these to .env.local:");
console.log(`NEXT_PUBLIC_LEMMA_CONTRACT=${contractAddress}`);
console.log(`LEMMA_DEPLOY_TX=${txHash}`);

const readinessError = formatReadinessError(readiness);
if (readinessError) {
  throw new Error(readinessError);
}

function requiredPrivateKey() {
  const value = process.env.GENLAYER_PRIVATE_KEY?.trim();
  if (!value || !/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error(
      "GENLAYER_PRIVATE_KEY must be a 0x-prefixed private key in .env.local.",
    );
  }
  return value;
}
