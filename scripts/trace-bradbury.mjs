import { createClient } from "genlayer-js";
import { testnetBradbury } from "genlayer-js/chains";

const hash = process.argv[2]?.trim();

if (!hash || !/^0x[0-9a-fA-F]{64}$/.test(hash)) {
  throw new Error("Pass a Bradbury transaction hash as the first argument.");
}

const client = createClient({
  chain: testnetBradbury,
});

const trace = await client.debugTraceTransaction({ hash });

console.log(JSON.stringify(trace, null, 2));
