const hre = require("hardhat");

async function main() {
  console.log("Preparing deployment of EscrowTask smart contract...");

  // Get the contract factory
  const EscrowTask = await hre.ethers.getContractFactory("EscrowTask");
  
  // Deploy the contract
  const escrowTask = await EscrowTask.deploy();

  // Wait for deployment completion
  await escrowTask.waitForDeployment();

  const contractAddress = await escrowTask.getAddress();
  console.log(`\n🎉 Success! EscrowTask contract deployed to: ${contractAddress}`);
  console.log("Use this address in your frontend configuration files.");
}

// Execute deployment pipeline
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error during contract deployment:", error);
    process.exit(1);
  });
