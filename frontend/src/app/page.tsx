import React from "react";
import { WalletConnect } from "../components/WalletConnect";
import { TaskDashboard } from "../components/TaskDashboard";

export default function Home() {
  return (
    <main className="max-w-6xl mx-auto px-4 py-12">
      {/* Hero section */}
      <header className="mb-12 text-center">
        <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-4">
          <span className="bg-gradient-hero bg-clip-text text-transparent">DefiTask Protocol</span>
        </h1>
        <p className="text-textSecondary max-w-xl mx-auto">
          Fund developer tasks in escrow, secure rewards via smart contracts on-chain, and release payments upon GitHub Pull Request verification.
        </p>
      </header>

      {/* Connect Card */}
      <section className="max-w-2xl mx-auto mb-8">
        <WalletConnect />
      </section>

      {/* Task Dashboard */}
      <section>
        <TaskDashboard />
      </section>
    </main>
  );
}
