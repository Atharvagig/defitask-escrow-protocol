const { ethers } = require("ethers");
const { getSigners, deployContract, provider } = require("./helpers");

async function main() {
  const signers = await getSigners();
  const client = signers[0];
  const developer = signers[1];

  console.log("Client address:", await client.getAddress());
  console.log("Developer address:", await developer.getAddress());

  console.log("Deploying contract...");
  const escrowTask = await deployContract(client);
  const contractAddr = await escrowTask.getAddress();
  console.log("Contract deployed to:", contractAddr);

  let bal = await provider.getBalance(contractAddr);
  console.log("Initial contract balance:", ethers.formatEther(bal));

  console.log("Creating task with 1.0 ETH...");
  const reward = ethers.parseEther("1.0");
  const tx = await escrowTask.connect(client).createTask("url", { value: reward });
  await tx.wait();

  bal = await provider.getBalance(contractAddr);
  console.log("Contract balance after creation:", ethers.formatEther(bal));

  console.log("Submitting task...");
  const txSubmit = await escrowTask.connect(developer).submitTask(1, "url-completion");
  await txSubmit.wait();

  console.log("Approving task...");
  const devBalBefore = await provider.getBalance(await developer.getAddress());
  const txApprove = await escrowTask.connect(client).approveTask(1);
  await txApprove.wait();

  bal = await provider.getBalance(contractAddr);
  console.log("Contract balance after approval:", ethers.formatEther(bal));

  const devBalAfter = await provider.getBalance(await developer.getAddress());
  console.log("Developer balance change:", ethers.formatEther(devBalAfter - devBalBefore));
}

main().catch(console.error);
