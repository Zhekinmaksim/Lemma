# Lemma

Lemma is a GenLayer citation court.

A user submits a claim, a source URL, and a stake. The contract fetches the
source, asks the validator jury to judge whether the claim is supported, and
writes a verdict on-chain. The web app reads those records from Bradbury and
lets users submit claims, inspect verdicts, and file one appeal.

This is not an abstract problem. In LLM-era publishing and research workflows,
authorship, provenance, and citation accuracy need to be established more
explicitly than before. If models are going to summarize, quote, and recombine
source material at scale, the record of who said what, where it was said, and
whether a citation is faithful stops being editorial overhead and becomes core
infrastructure.

## What is in this repo

- `lemma.py`
  The GenLayer contract. This is the project core.
- `app/`, `components/`, `lib/`
  The Next.js frontend that reads and writes to the deployed contract.
- `scripts/`
  Bradbury deployment, tracing, waiting, finalization, and smoke scripts.

## Runtime model

- Network: GenLayer Bradbury Testnet
- Contract language: Python
- Frontend: Next.js 14, App Router, TypeScript
- Chain client: `genlayer-js`
- Wallet signing: `window.ethereum`

## Important chain behavior

Bradbury has two states that matter in the UI:

- `accepted`
  The jury has accepted the transaction and the record is readable from the
  non-final surface.
- `finalized`
  The record is permanent.

The app treats those states explicitly. It does not pretend that `accepted`
already means final.

## Project layout

```text
lemma.py
app/
  page.tsx
  submit/page.tsx
  dashboard/page.tsx
  about/page.tsx
  v/[hash]/page.tsx
  api/og/[hash]/route.tsx
components/
  ClaimForm.tsx
  AppealButton.tsx
  VerdictFeed.tsx
  VerdictFeedItem.tsx
  VerdictBadge.tsx
  Topbar.tsx
  Footer.tsx
lib/
  abi.ts
  genlayer.ts
  wallet.ts
  format.ts
  citation.ts
scripts/
  deploy-bradbury.mjs
  wait-bradbury.mjs
  finalize-bradbury.mjs
  trace-bradbury.mjs
  smoke-bradbury.mjs
  bradbury-rpc.mjs
```

## Local setup

```bash
cp .env.example .env.local
npm install
```

Fill in:

- `NEXT_PUBLIC_LEMMA_CONTRACT`
  Contract address after deploy
- `GENLAYER_PRIVATE_KEY`
  Only for local deploy and smoke scripts
- `LEMMA_DEPLOY_TX`
  Optional but useful for diagnostics

Start the app:

```bash
npm run dev
```

## Frontend checks

```bash
npm run typecheck
npm run lint
npm run build
```

`next build` can print transient Bradbury read errors during static page
generation if the RPC is flaky. The build is still valid as long as it exits
successfully.

## Contract deploy to Bradbury

Deploy:

```bash
npm run deploy:bradbury
```

After deploy, copy the printed address and deploy tx hash into `.env.local`:

```bash
NEXT_PUBLIC_LEMMA_CONTRACT=0x...
LEMMA_DEPLOY_TX=0x...
```

Wait for receipt details:

```bash
npm run wait:bradbury -- <txHash>
```

Inspect execution:

```bash
npm run trace:bradbury -- <txHash>
```

If a transaction is accepted and later becomes ready for finalization, submit
the explicit finalization step:

```bash
npm run finalize:bradbury -- <txHash>
```

## Smoke tests

Read smoke:

```bash
npm run smoke:bradbury
```

Paid write smoke:

```bash
npm run smoke:bradbury:write
```

The write smoke sends a real `submit_claim` transaction with the contract
minimum stake. It verifies the full path:

- submit transaction
- wait for `accepted`
- resolve the claim hash
- read the verdict back from chain

If the finalization window does not open during the smoke timeout, the script
still succeeds once the accepted-state record is readable. That is intentional.

## Frontend behavior

The frontend talks to the contract only through `lib/genlayer.ts`.

Relevant rules:

- Reads use `latest-nonfinal` unless the code explicitly asks for finalized
  state.
- Verdict pages and feeds show whether a record is `accepted` or `finalized`.
- Submit and appeal flows wait on real Bradbury transaction state instead of
  arbitrary timers.
- Submit computes the expected `claim_hash` locally and redirects
  deterministically once the accepted-state verdict is readable.

## End-to-end review path

If you need to prove the project works end to end, this is the shortest path:

1. Set `GENLAYER_PRIVATE_KEY` in `.env.local`
2. Run `npm run deploy:bradbury`
3. Set `NEXT_PUBLIC_LEMMA_CONTRACT` and `LEMMA_DEPLOY_TX`
4. Run `npm run smoke:bradbury`
5. Run `npm run smoke:bradbury:write`
6. Start the app with `npm run dev`
7. Open `/submit`, file a claim, and verify that the verdict page resolves
   from the submitted transaction

## What this README does not try to do

It is not a GenLayer tutorial and it is not a design manifesto. It is only the
operational description of this repo.
