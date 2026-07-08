"use client";
import React, { useState, useEffect } from "react";
import { useWeb3 } from "../context/Web3Context";
import { ethers } from "ethers";
import { PlusCircle, ExternalLink, ShieldCheck, HelpCircle, RefreshCw, X, AlertCircle, Edit, Save } from "lucide-react";
import contractJson from "../abi/EscrowTask.json";

export interface Task {
  id: number;
  client: string;
  developer: string;
  reward: string;
  githubPrUrl: string;
  status: 0 | 1 | 2 | 3; // Created, Submitted, Approved, Cancelled
}

const DEFAULT_CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

export const TaskDashboard: React.FC = () => {
  const { account, provider, signer } = useWeb3();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  // Contract Configuration
  const [contractAddress, setContractAddress] = useState(DEFAULT_CONTRACT_ADDRESS);
  const [isEditingAddress, setIsEditingAddress] = useState(false);
  const [tempAddress, setTempAddress] = useState(DEFAULT_CONTRACT_ADDRESS);

  // Filters
  const [filter, setFilter] = useState<"all" | "created" | "submitted" | "approved" | "cancelled">("all");

  // Create Task Form Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [rewardInput, setRewardInput] = useState("");
  const [prUrlInput, setPrUrlInput] = useState("");

  // Submit PR Modal
  const [selectedTaskIdForSubmit, setSelectedTaskIdForSubmit] = useState<number | null>(null);
  const [submitPrUrlInput, setSubmitPrUrlInput] = useState("");

  // Get contract helper
  const getContract = (useSigner = false) => {
    if (useSigner && signer) {
      return new ethers.Contract(contractAddress, contractJson, signer);
    }
    if (provider) {
      return new ethers.Contract(contractAddress, contractJson, provider);
    }
    // Fallback to local JsonRpcProvider so tasks can load even if disconnected
    const localProvider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
    return new ethers.Contract(contractAddress, contractJson, localProvider);
  };

  // Fetch tasks
  const fetchTasksFromContract = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const contract = getContract();
      const countBig = await contract.tasksCount();
      const count = Number(countBig);
      const fetchedTasks: Task[] = [];

      for (let i = 1; i <= count; i++) {
        const details = await contract.getTaskDetails(i);
        fetchedTasks.push({
          id: i,
          client: details[0],
          developer: details[1],
          reward: ethers.formatEther(details[2]),
          githubPrUrl: details[3],
          status: Number(details[4]) as any,
        });
      }
      setTasks(fetchedTasks);
    } catch (err: any) {
      console.error("Error fetching tasks:", err);
      setErrorMsg("Failed to fetch tasks from contract. Ensure your local Hardhat node is running and the contract address is correct.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasksFromContract();
  }, [contractAddress, provider]);

  // Actions
  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signer) {
      setErrorMsg("Please connect your wallet first.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    setInfoMsg(null);
    try {
      const contract = getContract(true);
      const valueWei = ethers.parseEther(rewardInput);
      const tx = await contract.createTask(prUrlInput, { value: valueWei });
      setInfoMsg("Transaction sent! Waiting for confirmation...");
      await tx.wait();

      setRewardInput("");
      setPrUrlInput("");
      setShowCreateModal(false);
      setInfoMsg("Task successfully created & funded in escrow!");
      await fetchTasksFromContract();
    } catch (err: any) {
      console.error("Error creating task:", err);
      setErrorMsg(err.reason || err.message || "Failed to create task.");
      setInfoMsg(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitPr = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signer || selectedTaskIdForSubmit === null) {
      setErrorMsg("Please connect your wallet first.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    setInfoMsg(null);
    try {
      const contract = getContract(true);
      const tx = await contract.submitTask(selectedTaskIdForSubmit, submitPrUrlInput);
      setInfoMsg("Transaction sent! Waiting for confirmation...");
      await tx.wait();

      setSubmitPrUrlInput("");
      setSelectedTaskIdForSubmit(null);
      setInfoMsg("PR successfully submitted to escrow!");
      await fetchTasksFromContract();
    } catch (err: any) {
      console.error("Error submitting PR:", err);
      setErrorMsg(err.reason || err.message || "Failed to submit PR.");
      setInfoMsg(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApproveTask = async (taskId: number) => {
    if (!signer) return;

    setIsSubmitting(true);
    setErrorMsg(null);
    setInfoMsg(null);
    try {
      const contract = getContract(true);
      const tx = await contract.approveTask(taskId);
      setInfoMsg("Releasing funds... Waiting for confirmation...");
      await tx.wait();

      setInfoMsg("Task approved! Payout sent to developer.");
      await fetchTasksFromContract();
    } catch (err: any) {
      console.error("Error approving task:", err);
      setErrorMsg(err.reason || err.message || "Failed to approve task.");
      setInfoMsg(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelTask = async (taskId: number) => {
    if (!signer) return;

    setIsSubmitting(true);
    setErrorMsg(null);
    setInfoMsg(null);
    try {
      const contract = getContract(true);
      const tx = await contract.cancelTask(taskId);
      setInfoMsg("Refunding client... Waiting for confirmation...");
      await tx.wait();

      setInfoMsg("Task cancelled successfully. Refund returned.");
      await fetchTasksFromContract();
    } catch (err: any) {
      console.error("Error cancelling task:", err);
      setErrorMsg(err.reason || err.message || "Failed to cancel task.");
      setInfoMsg(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: number) => {
    switch (status) {
      case 0:
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">Created</span>;
      case 1:
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">Submitted</span>;
      case 2:
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">Approved</span>;
      case 3:
        return <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-red-500/20 text-red-300 border border-red-500/30">Cancelled</span>;
      default:
        return null;
    }
  };

  const filteredTasks = tasks.filter((t) => {
    if (filter === "all") return true;
    if (filter === "created") return t.status === 0;
    if (filter === "submitted") return t.status === 1;
    if (filter === "approved") return t.status === 2;
    if (filter === "cancelled") return t.status === 3;
    return true;
  });

  const activeEscrowSum = tasks
    .filter((t) => t.status === 0 || t.status === 1)
    .reduce((sum, t) => sum + parseFloat(t.reward), 0);

  const completedPayoutsSum = tasks
    .filter((t) => t.status === 2)
    .reduce((sum, t) => sum + parseFloat(t.reward), 0);

  return (
    <div className="mt-8 space-y-6">
      {/* Alert Notices */}
      {errorMsg && (
        <div className="bg-red-950/40 border border-red-500/30 text-red-300 p-3 rounded-lg text-sm flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
      {infoMsg && (
        <div className="bg-blue-950/40 border border-blue-500/30 text-blue-300 p-3 rounded-lg text-sm flex items-center gap-2">
          <RefreshCw className="h-4 w-4 animate-spin shrink-0" />
          <span>{infoMsg}</span>
        </div>
      )}

      {/* Contract Settings bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 bg-bgSurface border border-white/5 p-3 rounded-xl backdrop-blur-md text-xs">
        <div className="flex items-center gap-2 text-textSecondary">
          <span className="font-semibold">Contract Address:</span>
          {isEditingAddress ? (
            <input
              type="text"
              value={tempAddress}
              onChange={(e) => setTempAddress(e.target.value)}
              className="bg-bgMain border border-white/10 rounded px-2 py-0.5 text-textPrimary font-mono w-64 md:w-80 outline-none"
            />
          ) : (
            <span className="font-mono text-textPrimary">{contractAddress}</span>
          )}
        </div>
        <div className="flex gap-2">
          {isEditingAddress ? (
            <>
              <button
                onClick={() => {
                  setContractAddress(tempAddress);
                  setIsEditingAddress(false);
                }}
                className="flex items-center gap-1 bg-accentTeal/20 hover:bg-accentTeal/30 text-accentTeal px-2 py-1 rounded transition"
              >
                <Save className="h-3 w-3" /> Save
              </button>
              <button
                onClick={() => {
                  setTempAddress(contractAddress);
                  setIsEditingAddress(false);
                }}
                className="flex items-center gap-1 bg-white/5 hover:bg-white/10 text-textSecondary px-2 py-1 rounded transition"
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              onClick={() => setIsEditingAddress(true)}
              className="flex items-center gap-1 bg-white/5 hover:bg-white/10 text-textSecondary px-2 py-1 rounded transition"
            >
              <Edit className="h-3 w-3" /> Edit Contract Address
            </button>
          )}
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-bgSurface border border-white/5 backdrop-blur-md p-5 rounded-xl">
          <p className="text-sm font-semibold text-textSecondary">Total Tasks Listed</p>
          <p className="text-3xl font-bold text-textPrimary mt-2">{loading ? "..." : tasks.length}</p>
        </div>
        <div className="bg-bgSurface border border-white/5 backdrop-blur-md p-5 rounded-xl">
          <p className="text-sm font-semibold text-textSecondary">Active Escrow Balance</p>
          <p className="text-3xl font-bold text-accentPurple mt-2">{loading ? "..." : `${activeEscrowSum.toFixed(3)} ETH`}</p>
        </div>
        <div className="bg-bgSurface border border-white/5 backdrop-blur-md p-5 rounded-xl">
          <p className="text-sm font-semibold text-textSecondary">Released Payments</p>
          <p className="text-3xl font-bold text-accentTeal mt-2">{loading ? "..." : `${completedPayoutsSum.toFixed(3)} ETH`}</p>
        </div>
      </div>

      {/* Control Block */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-bgSurface border border-white/5 p-4 rounded-xl backdrop-blur-md">
        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          {(["all", "created", "submitted", "approved", "cancelled"] as const).map((opt) => (
            <button
              key={opt}
              onClick={() => setFilter(opt)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition border ${
                filter === opt
                  ? "bg-accentPurple/20 border-accentPurple/40 text-accentPurple"
                  : "bg-white/5 border-transparent text-textSecondary hover:bg-white/10"
              }`}
            >
              {opt.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Action button */}
        <div className="flex gap-2">
          <button
            onClick={fetchTasksFromContract}
            disabled={loading}
            className="flex items-center gap-1.5 bg-white/5 border border-white/10 hover:bg-white/10 text-textSecondary p-2 rounded-lg text-sm transition"
            title="Refresh List"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            disabled={!account || isSubmitting}
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 bg-gradient-hero hover:opacity-95 disabled:opacity-40 text-bgMain px-4 py-2 rounded-lg text-sm font-semibold transition shadow-md"
          >
            <PlusCircle className="h-4 w-4" />
            Create Task (Escrow)
          </button>
        </div>
      </div>

      {/* Task List Grid */}
      <div className="bg-bgSurface border border-white/5 rounded-xl backdrop-blur-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 text-xs font-semibold text-textSecondary uppercase tracking-wider bg-white/5">
                <th className="p-4">ID</th>
                <th className="p-4">Client</th>
                <th className="p-4">Task Info (Issue/PR Link)</th>
                <th className="p-4">Reward</th>
                <th className="p-4">Developer</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-sm">
              {loading && tasks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-textMuted">
                    <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-accentPurple" />
                    Fetching tasks from blockchain...
                  </td>
                </tr>
              ) : filteredTasks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-textMuted">
                    No tasks found matching the filter selection.
                  </td>
                </tr>
              ) : (
                filteredTasks.map((task) => {
                  const isClient = account && task.client.toLowerCase() === account.toLowerCase();
                  return (
                    <tr key={task.id} className="hover:bg-white/[0.02] transition">
                      <td className="p-4 font-mono font-bold text-accentIndigo">#{task.id}</td>
                      <td className="p-4 font-mono text-xs text-textSecondary">
                        {account && task.client.toLowerCase() === account.toLowerCase() ? (
                          <span className="text-accentPurple font-semibold">You (Client)</span>
                        ) : (
                          `${task.client.slice(0, 6)}...${task.client.slice(-4)}`
                        )}
                      </td>
                      <td className="p-4">
                        {task.githubPrUrl.startsWith("http") ? (
                          <a
                            href={task.githubPrUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 text-textPrimary hover:text-accentPurple transition font-medium"
                          >
                            {task.githubPrUrl.replace("https://github.com/", "")}
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        ) : (
                          <span className="text-textPrimary font-medium">{task.githubPrUrl}</span>
                        )}
                      </td>
                      <td className="p-4 font-bold text-accentTeal">{task.reward} ETH</td>
                      <td className="p-4 font-mono text-xs text-textSecondary">
                        {task.developer === ethers.ZeroAddress ? (
                          "Unclaimed"
                        ) : account && task.developer.toLowerCase() === account.toLowerCase() ? (
                          <span className="text-accentTeal font-semibold">You (Dev)</span>
                        ) : (
                          `${task.developer.slice(0, 6)}...${task.developer.slice(-4)}`
                        )}
                      </td>
                      <td className="p-4">{getStatusBadge(task.status)}</td>
                      <td className="p-4 text-right">
                        {task.status === 0 && (
                          <div className="flex justify-end gap-2">
                            {isClient ? (
                              <button
                                disabled={isSubmitting}
                                onClick={() => handleCancelTask(task.id)}
                                className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 px-3 py-1 rounded text-xs transition"
                              >
                                Cancel Task
                              </button>
                            ) : (
                              <button
                                disabled={!account || isSubmitting}
                                onClick={() => {
                                  setSelectedTaskIdForSubmit(task.id);
                                  setSubmitPrUrlInput("");
                                }}
                                className="bg-accentIndigo/20 hover:bg-accentIndigo/30 text-accentIndigo border border-accentIndigo/30 px-3 py-1 rounded text-xs transition disabled:opacity-40"
                              >
                                Submit PR
                              </button>
                            )}
                          </div>
                        )}
                        {task.status === 1 && (
                          <div className="flex justify-end gap-2">
                            {isClient ? (
                              <>
                                <button
                                  disabled={isSubmitting}
                                  onClick={() => handleCancelTask(task.id)}
                                  className="bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 px-3 py-1 rounded text-xs transition"
                                >
                                  Cancel Task
                                </button>
                                <button
                                  disabled={isSubmitting}
                                  onClick={() => handleApproveTask(task.id)}
                                  className="bg-emerald-500/25 hover:bg-emerald-500/40 text-emerald-300 border border-emerald-500/30 px-3 py-1 rounded text-xs transition font-semibold"
                                >
                                  Approve & Pay
                                </button>
                              </>
                            ) : (
                              // Allow developers to update their PR
                              account && task.developer.toLowerCase() === account.toLowerCase() ? (
                                <button
                                  disabled={isSubmitting}
                                  onClick={() => {
                                    setSelectedTaskIdForSubmit(task.id);
                                    setSubmitPrUrlInput(task.githubPrUrl);
                                  }}
                                  className="bg-accentIndigo/20 hover:bg-accentIndigo/30 text-accentIndigo border border-accentIndigo/30 px-3 py-1 rounded text-xs transition"
                                >
                                  Update PR
                                </button>
                              ) : (
                                <span className="text-xs text-textMuted">Under Review</span>
                              )
                            )}
                          </div>
                        )}
                        {task.status === 2 && (
                          <span className="text-xs text-textMuted flex items-center justify-end gap-1 font-semibold">
                            <ShieldCheck className="h-3.5 w-3.5 text-accentTeal" /> Payout Settled
                          </span>
                        )}
                        {task.status === 3 && (
                          <span className="text-xs text-textMuted flex items-center justify-end gap-1 font-semibold">
                            <HelpCircle className="h-3.5 w-3.5 text-red-400" /> Cancelled
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Task Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#0d1121] border border-white/10 rounded-2xl w-full max-w-md p-6 relative shadow-2xl">
            <button
              onClick={() => setShowCreateModal(false)}
              className="absolute top-4 right-4 text-textSecondary hover:text-textPrimary"
            >
              <X className="h-5 w-5" />
            </button>
            <h2 className="text-xl font-bold text-textPrimary mb-4">Create Task & Escrow</h2>
            
            <form onSubmit={handleCreateTask} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-textSecondary uppercase tracking-wider mb-2">
                  Reward Amount (ETH)
                </label>
                <input
                  type="number"
                  step="0.001"
                  min="0.001"
                  required
                  placeholder="e.g. 0.5"
                  value={rewardInput}
                  onChange={(e) => setRewardInput(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 focus:border-accentPurple rounded-xl px-4 py-2.5 text-textPrimary outline-none transition font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-textSecondary uppercase tracking-wider mb-2">
                  GitHub PR / Issue URL
                </label>
                <input
                  type="url"
                  required
                  placeholder="e.g. https://github.com/org/repo/pull/1"
                  value={prUrlInput}
                  onChange={(e) => setPrUrlInput(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 focus:border-accentPurple rounded-xl px-4 py-2.5 text-textPrimary outline-none transition font-medium"
                />
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-textSecondary hover:bg-white/5 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-gradient-hero text-bgMain font-semibold px-5 py-2 rounded-xl hover:opacity-95 transition disabled:opacity-50"
                >
                  {isSubmitting ? "Creating..." : "Confirm & Deposit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Submit PR Modal */}
      {selectedTaskIdForSubmit !== null && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#0d1121] border border-white/10 rounded-2xl w-full max-w-md p-6 relative shadow-2xl">
            <button
              onClick={() => setSelectedTaskIdForSubmit(null)}
              className="absolute top-4 right-4 text-textSecondary hover:text-textPrimary"
            >
              <X className="h-5 w-5" />
            </button>
            <h2 className="text-xl font-bold text-textPrimary mb-4">Submit Task Pull Request</h2>
            
            <form onSubmit={handleSubmitPr} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-textSecondary uppercase tracking-wider mb-2">
                  GitHub Pull Request Link
                </label>
                <input
                  type="url"
                  required
                  placeholder="e.g. https://github.com/org/repo/pull/1"
                  value={submitPrUrlInput}
                  onChange={(e) => setSubmitPrUrlInput(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 focus:border-accentPurple rounded-xl px-4 py-2.5 text-textPrimary outline-none transition font-medium"
                />
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setSelectedTaskIdForSubmit(null)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold text-textSecondary hover:bg-white/5 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-gradient-hero text-bgMain font-semibold px-5 py-2 rounded-xl hover:opacity-95 transition disabled:opacity-50"
                >
                  {isSubmitting ? "Submitting..." : "Submit PR"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
