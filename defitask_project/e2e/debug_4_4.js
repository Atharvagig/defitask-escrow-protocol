const { ethers } = require("ethers");
const { getSigners, deployContract, provider } = require("./helpers");

async function main() {
  const signers = await getSigners();
  const client = signers[0];
  const developer = signers[1];

  const escrowTask = await deployContract(client);
  const contractAddr = await escrowTask.getAddress();
  const rewardAmount = ethers.parseEther("1.0");

  async function getBalance(address) {
    const rawBalance = await provider.send("eth_getBalance", [address, "latest"]);
    return BigInt(rawBalance);
  }

  // --- Task Creation ---
  console.log("--- 1.4 equivalent ---");
  const clientAddress = await client.getAddress();
  const clientBalanceBefore1 = await getBalance(clientAddress);
  
  const tx1 = await escrowTask.connect(client).createTask("url", { value: rewardAmount });
  const receipt1 = await tx1.wait();

  const clientBalanceAfter1 = await getBalance(clientAddress);
  const gasUsed1 = BigInt(receipt1.gasUsed);
  const gasPrice1 = BigInt(receipt1.effectiveGasPrice || tx1.gasPrice || receipt1.gasPrice || 0);
  const gasCost1 = gasUsed1 * gasPrice1;

  console.log("gasUsed1:", gasUsed1.toString());
  console.log("gasPrice1:", gasPrice1.toString());
  console.log("gasCost1:", gasCost1.toString());
  console.log("clientBalanceBefore1:", clientBalanceBefore1.toString());
  console.log("clientBalanceAfter1: ", clientBalanceAfter1.toString());
  const expected1 = clientBalanceBefore1 - rewardAmount - gasCost1;
  console.log("expected1:          ", expected1.toString());
  console.log("Difference1:        ", (clientBalanceAfter1 - expected1).toString());

  // --- Task Cancellation ---
  console.log("\n--- 4.4 equivalent ---");
  const clientBalanceBefore4 = await getBalance(clientAddress);
  
  const txCancel = await escrowTask.connect(client).cancelTask(1);
  const receipt4 = await txCancel.wait();

  const clientBalanceAfter4 = await getBalance(clientAddress);
  const gasUsed4 = BigInt(receipt4.gasUsed);
  const gasPrice4 = BigInt(receipt4.effectiveGasPrice || txCancel.gasPrice || receipt4.gasPrice || 0);
  const gasCost4 = gasUsed4 * gasPrice4;

  console.log("gasUsed4:", gasUsed4.toString());
  console.log("gasPrice4:", gasPrice4.toString());
  console.log("gasCost4:", gasCost4.toString());
  console.log("clientBalanceBefore4:", clientBalanceBefore4.toString());
  console.log("clientBalanceAfter4: ", clientBalanceAfter4.toString());
  const expected4 = clientBalanceBefore4 + rewardAmount - gasCost4;
  console.log("expected4:          ", expected4.toString());
  console.log("Difference4:        ", (clientBalanceAfter4 - expected4).toString());
}

main().catch(console.error);
