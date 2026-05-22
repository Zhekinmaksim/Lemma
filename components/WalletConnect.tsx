"use client";

import { useWallet } from "@/lib/wallet";
import { truncateAddress } from "@/lib/format";

/**
 * WalletConnect
 *
 * Three states, per the design handoff:
 *
 *   idle:        "connect wallet →"             (ink underline)
 *   connecting:  "connecting▍"                  (rust blinking caret, disabled)
 *   connected:   "● 0x4a8c…8f3b"                 (green dot + green underline)
 *
 * The button uses the .wallet-btn class from globals.css. There is no
 * dropdown; clicking a connected button disconnects.
 *
 * If no provider (e.g. browser without MetaMask), surface a quiet
 * install link instead. Stays on-brand: same mono caps treatment.
 */
export function WalletConnect() {
  const { address, connecting, error, hasProvider, connect, disconnect } = useWallet();

  if (!hasProvider) {
    return (
      <a
        href="https://metamask.io/download/"
        className="wallet-btn"
        style={{ borderBottomColor: "var(--lemma-divider)", color: "var(--lemma-ink-muted)" }}
        target="_blank"
        rel="noreferrer noopener"
        title="Install a wallet to interact with Lemma"
      >
        install wallet &rarr;
      </a>
    );
  }

  if (address) {
    return (
      <button
        type="button"
        onClick={disconnect}
        className="wallet-btn connected"
        title="Disconnect"
      >
        <span className="dot" aria-hidden="true" />
        {truncateAddress(address)}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={connect}
      disabled={connecting}
      className="wallet-btn"
      aria-live="polite"
    >
      {connecting ? (
        <>
          connecting
          <span className="caret" aria-hidden="true" />
        </>
      ) : (
        <>connect wallet &rarr;</>
      )}
      {!!error && !connecting && (
        <span
          className="font-serif italic"
          style={{
            marginLeft: "0.6rem",
            color: "var(--lemma-error)",
            fontSize: "0.85rem",
            textTransform: "none",
            letterSpacing: 0,
          }}
        >
          ({error})
        </span>
      )}
    </button>
  );
}
