/**
 * Wallet connection.
 *
 * Lemma uses a deliberately minimal connect surface. The genlayer-js
 * SDK delegates signing to window.ethereum directly when given an
 * address, so all we need from the browser is:
 *
 *   1. The connected EOA address (eth_requestAccounts).
 *   2. Notification when the user switches accounts or networks.
 *
 * No wagmi, no WalletConnect modal, no chain switcher abstractions.
 * One serif "Connect Wallet" link, that's the entire UI surface.
 */

"use client";

import { useEffect, useState, useCallback } from "react";

type EthAddress = `0x${string}`;

interface EthereumProvider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
}

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

export interface WalletState {
  address: EthAddress | null;
  connecting: boolean;
  error: string | null;
  hasProvider: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
}

export function useWallet(): WalletState {
  const [address, setAddress] = useState<EthAddress | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasProvider, setHasProvider] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const eth = window.ethereum;
    setHasProvider(Boolean(eth));
    if (!eth) return;

    // Restore prior connection on mount without prompting.
    eth.request({ method: "eth_accounts" })
      .then((accts) => {
        const arr = (accts as string[]) ?? [];
        if (arr.length > 0 && arr[0]?.startsWith("0x")) {
          setAddress(arr[0] as EthAddress);
        }
      })
      .catch(() => {
        /* silent: not connected */
      });

    const handleAccountsChanged = (...args: unknown[]) => {
      const accts = (args[0] as string[]) ?? [];
      if (accts.length === 0) {
        setAddress(null);
      } else if (accts[0]?.startsWith("0x")) {
        setAddress(accts[0] as EthAddress);
      }
    };

    const handleChainChanged = () => {
      // Reload on chain switch is the canonical pattern; keeps state
      // consistent without a network-aware reducer.
      window.location.reload();
    };

    eth.on?.("accountsChanged", handleAccountsChanged);
    eth.on?.("chainChanged", handleChainChanged);

    return () => {
      eth.removeListener?.("accountsChanged", handleAccountsChanged);
      eth.removeListener?.("chainChanged", handleChainChanged);
    };
  }, []);

  const connect = useCallback(async () => {
    if (typeof window === "undefined" || !window.ethereum) {
      setError("No Ethereum-compatible wallet detected.");
      return;
    }
    setConnecting(true);
    setError(null);
    try {
      const accts = (await window.ethereum.request({
        method: "eth_requestAccounts",
      })) as string[];
      if (accts && accts[0]?.startsWith("0x")) {
        setAddress(accts[0] as EthAddress);
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Connection cancelled.";
      setError(message);
    } finally {
      setConnecting(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAddress(null);
  }, []);

  return { address, connecting, error, hasProvider, connect, disconnect };
}
