"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { ethers } from "ethers";

interface Web3ContextType {
  account: string | null;
  balance: string | null;
  chainId: bigint | null;
  provider: ethers.BrowserProvider | null;
  signer: ethers.JsonRpcSigner | null;
  error: string | null;
  connectWallet: () => Promise<void>;
  isConnecting: boolean;
  isCorrectNetwork: boolean;
}

const Web3Context = createContext<Web3ContextType>({
  account: null,
  balance: null,
  chainId: null,
  provider: null,
  signer: null,
  error: null,
  connectWallet: async () => {},
  isConnecting: false,
  isCorrectNetwork: false,
});

export const Web3Provider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [account, setAccount] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [chainId, setChainId] = useState<bigint | null>(null);
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [signer, setSigner] = useState<ethers.JsonRpcSigner | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const HARDHAT_CHAIN_ID = 31337n;

  const updateAccountAndBalance = async (prov: ethers.BrowserProvider, acc: string) => {
    try {
      const bal = await prov.getBalance(acc);
      setBalance(ethers.formatEther(bal));
      const network = await prov.getNetwork();
      setChainId(network.chainId);
      const sig = await prov.getSigner();
      setSigner(sig);
    } catch (err: any) {
      console.error("Error updating account details:", err);
    }
  };

  const connectWallet = async () => {
    if (typeof window === "undefined" || !window.ethereum) {
      setError("MetaMask is not installed. Please install MetaMask to use this DApp.");
      return;
    }

    setIsConnecting(true);
    setError(null);
    try {
      const accounts: string[] = await window.ethereum.request({
        method: "eth_requestAccounts",
      });
      const selectedAccount = accounts[0];
      setAccount(selectedAccount);

      const prov = new ethers.BrowserProvider(window.ethereum);
      setProvider(prov);
      await updateAccountAndBalance(prov, selectedAccount);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to connect wallet.");
    } finally {
      setIsConnecting(false);
    }
  };

  useEffect(() => {
    if (typeof window !== "undefined" && window.ethereum) {
      const prov = new ethers.BrowserProvider(window.ethereum);
      setProvider(prov);

      const handleAccountsChanged = async (accounts: string[]) => {
        if (accounts.length === 0) {
          setAccount(null);
          setBalance(null);
          setSigner(null);
          setChainId(null);
        } else {
          setAccount(accounts[0]);
          await updateAccountAndBalance(prov, accounts[0]);
        }
      };

      const handleChainChanged = () => {
        window.location.reload();
      };

      window.ethereum.on("accountsChanged", handleAccountsChanged);
      window.ethereum.on("chainChanged", handleChainChanged);

      window.ethereum.request({ method: "eth_accounts" })
        .then(async (accounts: string[]) => {
          if (accounts.length > 0) {
            setAccount(accounts[0]);
            await updateAccountAndBalance(prov, accounts[0]);
          }
        })
        .catch(console.error);

      return () => {
        if (window.ethereum.removeListener) {
          window.ethereum.removeListener("accountsChanged", handleAccountsChanged);
          window.ethereum.removeListener("chainChanged", handleChainChanged);
        }
      };
    }
  }, []);

  const isCorrectNetwork = chainId === HARDHAT_CHAIN_ID;

  return (
    <Web3Context.Provider
      value={{
        account,
        balance,
        chainId,
        provider,
        signer,
        error,
        connectWallet,
        isConnecting,
        isCorrectNetwork,
      }}
    >
      {children}
    </Web3Context.Provider>
  );
};

export const useWeb3 = () => useContext(Web3Context);
