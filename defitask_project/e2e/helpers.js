const { ethers } = require("ethers");
const fs = require("fs");
const path = require("path");

// JsonRpcProvider targeting http://127.0.0.1:8545
const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");

/**
 * Helper to get the contract artifact (ABI and bytecode)
 */
function getArtifact() {
  const artifactPath = path.join(__dirname, "../artifacts/contracts/EscrowTask.sol/EscrowTask.json");
  if (!fs.existsSync(artifactPath)) {
    throw new Error(`Artifact not found at ${artifactPath}. Please run contract compilation first.`);
  }
  return JSON.parse(fs.readFileSync(artifactPath, "utf8"));
}

/**
 * Retrieves accounts (signers) from the provider.
 */
async function getSigners() {
  const accounts = await provider.listAccounts();
  if (accounts.length > 0 && typeof accounts[0] === "string") {
    // ethers v5 fallback
    return Promise.all(accounts.map(address => provider.getSigner(address)));
  }
  // ethers v6 returns Signer[] directly
  return accounts;
}

/**
 * Deploys the EscrowTask contract using the provided signer.
 */
async function deployContract(signer) {
  const artifact = getArtifact();
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, signer);
  const contract = await factory.deploy();
  
  if (typeof contract.waitForDeployment === "function") {
    await contract.waitForDeployment();
  } else if (typeof contract.deployed === "function") {
    await contract.deployed();
  }
  return contract;
}

/**
 * Instantiates an EscrowTask contract at a specific address.
 */
function getContractInstance(address, signer) {
  const artifact = getArtifact();
  return new ethers.Contract(address, artifact.abi, signer);
}

/**
 * Parses receipt logs using the provided interface to extract events by name.
 */
function getEventLogs(receipt, eventName, contractInterface) {
  const logs = receipt.logs || receipt.events || [];
  const parsedLogs = [];
  
  for (const log of logs) {
    try {
      const parsed = contractInterface.parseLog(log);
      if (parsed && parsed.name === eventName) {
        parsedLogs.push(parsed);
      }
    } catch (e) {
      // Ignore if log is from another contract or parsing fails
    }
  }
  return parsedLogs;
}

module.exports = {
  provider,
  getArtifact,
  getSigners,
  deployContract,
  getContractInstance,
  getEventLogs
};
