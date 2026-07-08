"use client";

import React from "react";
import { useWeb3 } from "../context/Web3Context";
import { Wallet, AlertTriangle, RefreshCw } from "lucide-react";

export const WalletConnect: React.FC = () => {
  const { account, balance, error, connectWallet, isConnecting, isCorrectNetwork } = useWeb3();

  const truncateAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const requestNetworkSwitch = async () => {
    if (typeof window !== "undefined" && window.ethereum) {
      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0x7a69" }], // 31337 in hex
        });
      } catch (switchError: any) {
        if (switchError.code === 4902) {
          try {
            await window.ethereum.request({
              method: "wallet_addEthereumChain",
              params: [
                {
                  chainId: "0x7a69",
                  chainName: "Hardhat Localhost",
                  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
                  rpcUrls: ["http://127.0.0.1:8545"],
                },
              ],
            });
          } catch (addError) {
            console.error(addError);
          }
        }
      }
    }
  };

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <div className="bg-red-950/40 border border-red-500/30 text-red-300 p-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {account && !isCorrectNetwork && (
        <div className="bg-amber-950/40 border border-amber-500/30 text-amber-300 p-3 rounded-lg text-sm flex items-center justify-between">
          <span className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Please connect to Hardhat Localhost (Port 8545)
          </span>
          <button
            onClick={requestNetworkSwitch}
            className="bg-amber-500 hover:bg-amber-600 text-bgMain px-3 py-1 rounded text-xs font-semibold transition"
          >
            Switch Network
          </button>
        </div>
      )}

      <div className="flex items-center justify-between bg-bgSurface border border-white/10 backdrop-blur-md p-4 rounded-xl">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-accentPurple/20 rounded-lg text-accentPurple">
            <Wallet className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-textSecondary">EVM Account</h3>
            <p className="text-base text-textPrimary font-mono">
              {account ? truncateAddress(account) : "Disconnected"}
            </p>
          </div>
        </div>

        {account ? (
          <div className="text-right">
            <h3 className="text-sm font-semibold text-textSecondary">Balance</h3>
            <p className="text-lg font-bold text-accentTeal">{parseFloat(balance || "0").toFixed(4)} ETH</p>
          </div>
        ) : (
          <button
            onClick={connectWallet}
            disabled={isConnecting}
            className="flex items-center gap-2 bg-gradient-hero text-bgMain font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition disabled:opacity-50"
          >
            {isConnecting ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              "Connect MetaMask"
            )}
          </button>
        )}
      </div>
    </div>
  );
};
