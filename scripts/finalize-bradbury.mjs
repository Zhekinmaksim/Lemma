import { createAccount, createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";

const hash = process.argv[2]?.trim();

if (!hash || !/^0x[0-9a-fA-F]{64}$/.test(hash)) {
  throw new Error("Pass a Bradbury transaction hash as the first argument.");
}

const privateKey = process.env.GENLAYER_PRIVATE_KEY?.trim();
if (!privateKey || !/^0x[0-9a-fA-F]{64}$/.test(privateKey)) {
  throw new Error(
    "GENLAYER_PRIVATE_KEY must be a 0x-prefixed private key in .env.local.",
  );
}

const client = createClient({
  account: createAccount(privateKey),
  chain: testnetBradbury,
});

const finalizeHash = await client.finalizeTransaction({ txId: hash });

console.log(`Finalization transaction: ${finalizeHash}`);
