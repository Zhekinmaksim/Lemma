import { createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";
import { TransactionStatus } from "genlayer-js/types";
import {
  formatReadinessError,
  inspectDeploymentReadiness,
} from "./bradbury-rpc.mjs";

const hash = process.argv[2]?.trim();

if (!hash || !/^0x[0-9a-fA-F]{64}$/.test(hash)) {
  throw new Error("Pass a Bradbury transaction hash as the first argument.");
}

const client = createClient({
  chain: testnetBradbury,
});

const receipt = await client.waitForTransactionReceipt({
  hash,
  status: TransactionStatus.FINALIZED,
  retries: 240,
  interval: 5000,
});

const readiness = await inspectDeploymentReadiness({
  txId: hash,
  address:
    receipt.data?.contract_address ?? receipt.txDataDecoded?.contractAddress,
});

console.log(
  JSON.stringify(
    {
      hash,
      status: receipt.statusName,
      execution: receipt.txExecutionResultName,
      contractAddress: readiness.address,
      readinessError: formatReadinessError(readiness),
      sync: readiness.sync,
    },
    null,
    2,
  ),
);
