const assert = require("assert");
const { ethers } = require("ethers");
const { getSigners, deployContract, getEventLogs, provider } = require("./helpers");

describe("EscrowTask E2E Test Suite - Milestone 2 (Tier 1 Feature Coverage)", function () {
  let client;
  let developer;
  let thirdParty;
  let escrowTask;

  // Helper to parse values to BigInt regardless of ethers version (v5 BigNumber vs v6 bigint)
  function toBigInt(val) {
    if (!val) return 0n;
    return BigInt(val.toString());
  }

  // Helper to resolve contract address regardless of ethers version
  async function getContractAddress(contract) {
    if (contract.target) {
      if (typeof contract.target === "string") {
        return contract.target;
      }
      if (typeof contract.target.getAddress === "function") {
        return await contract.target.getAddress();
      }
    }
    if (typeof contract.getAddress === "function") {
      return await contract.getAddress();
    }
    return contract.address;
  }

  // Helper to get latest balance bypassing ethers v6 caching
  async function getBalance(address) {
    const rawBalance = await provider.send("eth_getBalance", [address, "latest"]);
    return toBigInt(rawBalance);
  }



  // Helper to assert transaction reverts with expected message
  async function assertRevert(promise, expectedMessage) {
    try {
      await promise;
      assert.fail("Transaction should have reverted but succeeded");
    } catch (error) {
      if (error.code === "ERR_ASSERTION" && error.message.includes("Transaction should have reverted")) {
        throw error;
      }
      const msg = error.message || "";
      const dataMsg = (error.data && error.data.message) || "";
      const innerMsg = (error.error && error.error.message) || "";
      
      const matches = msg.includes(expectedMessage) || 
                      dataMsg.includes(expectedMessage) || 
                      innerMsg.includes(expectedMessage);
      assert.ok(
        matches,
        `Expected revert message to contain "${expectedMessage}", but got: "${msg}" | "${dataMsg}" | "${innerMsg}"`
      );
    }
  }

  const rewardAmount = toBigInt(ethers.parseEther ? ethers.parseEther("1.0") : ethers.utils.parseEther("1.0"));
  const githubPrUrl = "https://github.com/test/repo/pull/1";

  before(async function () {
    const signers = await getSigners();
    if (signers.length < 3) {
      throw new Error("E2E tests require at least 3 accounts from the JsonRpcProvider.");
    }
    client = signers[0];
    developer = signers[1];
    thirdParty = signers[2];
  });

  beforeEach(async function () {
    // Deploy a fresh contract before each test for absolute state isolation
    escrowTask = await deployContract(client);
  });

  // ==========================================
  // CORE FEATURE 1: Task Creation (5 tests)
  // ==========================================

  it("1.1: should successfully create a task with valid inputs and verify details", async function () {
    const tx = await escrowTask.connect(client).createTask(githubPrUrl, { value: rewardAmount });
    await tx.wait();

    const tasksCount = await escrowTask.tasksCount();
    assert.strictEqual(tasksCount.toString(), "1", "tasksCount should be 1");

    const details = await escrowTask.getTaskDetails(1);
    const clientAddress = await client.getAddress();
    assert.strictEqual(details.client.toLowerCase(), clientAddress.toLowerCase(), "Task client should match");
    assert.strictEqual(details.developer, ethers.ZeroAddress || "0x0000000000000000000000000000000000000000", "Developer should be zero address");
    assert.strictEqual(details.reward.toString(), rewardAmount.toString(), "Task reward should match");
    assert.strictEqual(details.githubPrUrl, githubPrUrl, "Task PR URL should match");
    assert.strictEqual(details.status.toString(), "0", "Task status should be Created (0)");
  });

  it("1.2: should emit TaskCreated event on task creation", async function () {
    const tx = await escrowTask.connect(client).createTask(githubPrUrl, { value: rewardAmount });
    const receipt = await tx.wait();

    const eventLogs = getEventLogs(receipt, "TaskCreated", escrowTask.interface);
    assert.strictEqual(eventLogs.length, 1, "Should emit exactly one TaskCreated event");
    
    const eventArgs = eventLogs[0].args;
    const taskId = eventArgs[0] !== undefined ? eventArgs[0] : eventArgs.taskId;
    const eventClient = eventArgs[1] !== undefined ? eventArgs[1] : eventArgs.client;
    const eventReward = eventArgs[2] !== undefined ? eventArgs[2] : eventArgs.reward;
    const eventUrl = eventArgs[3] !== undefined ? eventArgs[3] : eventArgs.githubPrUrl;

    const clientAddress = await client.getAddress();
    assert.strictEqual(taskId.toString(), "1", "Task ID should be 1");
    assert.strictEqual(eventClient.toLowerCase(), clientAddress.toLowerCase(), "Event client address should match");
    assert.strictEqual(eventReward.toString(), rewardAmount.toString(), "Event reward should match");
    assert.strictEqual(eventUrl, githubPrUrl, "Event PR URL should match");
  });

  it("1.3: should revert task creation when reward is zero", async function () {
    await assertRevert(
      escrowTask.connect(client).createTask(githubPrUrl, { value: 0 }),
      "Reward amount must be greater than zero"
    );

    const tasksCount = await escrowTask.tasksCount();
    assert.strictEqual(tasksCount.toString(), "0", "No task should be created");
  });

  it("1.4: should verify client and contract balance updates on task creation", async function () {
    const clientAddress = await client.getAddress();
    const clientBalanceBefore = await getBalance(clientAddress);
    
    const contractAddr = await getContractAddress(escrowTask);
    const contractBalanceBefore = await getBalance(contractAddr);
    assert.strictEqual(contractBalanceBefore.toString(), "0", "Contract balance should start at 0");

    const tx = await escrowTask.connect(client).createTask(githubPrUrl, { value: rewardAmount });
    const receipt = await tx.wait();

    const contractBalanceAfter = await getBalance(contractAddr);
    assert.strictEqual(contractBalanceAfter.toString(), rewardAmount.toString(), "Contract balance should increase by reward");

    const clientBalanceAfter = await getBalance(clientAddress);
    const gasUsed = toBigInt(receipt.gasUsed);
    const gasPrice = toBigInt(receipt.effectiveGasPrice || tx.gasPrice || receipt.gasPrice || 0);
    const gasCost = gasUsed * gasPrice;

    const expectedClientBalance = clientBalanceBefore - rewardAmount - gasCost;
    assert.strictEqual(clientBalanceAfter.toString(), expectedClientBalance.toString(), "Client balance should decrease by reward + gas");
  });

  it("1.5: should support multiple sequential task creations by different clients", async function () {
    const clientAddress = await client.getAddress();
    const thirdPartyAddress = await thirdParty.getAddress();

    const tx1 = await escrowTask.connect(client).createTask("url1", { value: rewardAmount });
    await tx1.wait();

    const reward2 = rewardAmount * 2n;
    const tx2 = await escrowTask.connect(thirdParty).createTask("url2", { value: reward2 });
    await tx2.wait();

    const tasksCount = await escrowTask.tasksCount();
    assert.strictEqual(tasksCount.toString(), "2", "tasksCount should be 2");

    const task1 = await escrowTask.getTaskDetails(1);
    assert.strictEqual(task1.client.toLowerCase(), clientAddress.toLowerCase(), "Task 1 client should be client");
    assert.strictEqual(task1.reward.toString(), rewardAmount.toString(), "Task 1 reward should match");
    assert.strictEqual(task1.githubPrUrl, "url1", "Task 1 PR URL should match");

    const task2 = await escrowTask.getTaskDetails(2);
    assert.strictEqual(task2.client.toLowerCase(), thirdPartyAddress.toLowerCase(), "Task 2 client should be thirdParty");
    assert.strictEqual(task2.reward.toString(), reward2.toString(), "Task 2 reward should match");
    assert.strictEqual(task2.githubPrUrl, "url2", "Task 2 PR URL should match");
  });

  // ==========================================
  // CORE FEATURE 2: PR Submission (6 tests)
  // ==========================================

  it("2.1: should successfully submit PR work and update task details", async function () {
    const txCreate = await escrowTask.connect(client).createTask(githubPrUrl, { value: rewardAmount });
    await txCreate.wait();

    const prUrlSubmit = "https://github.com/test/repo/pull/1/submit";
    const txSubmit = await escrowTask.connect(developer).submitTask(1, prUrlSubmit);
    await txSubmit.wait();

    const details = await escrowTask.getTaskDetails(1);
    const developerAddress = await developer.getAddress();
    assert.strictEqual(details.developer.toLowerCase(), developerAddress.toLowerCase(), "Developer should be set");
    assert.strictEqual(details.githubPrUrl, prUrlSubmit, "githubPrUrl should update to submitted PR");
    assert.strictEqual(details.status.toString(), "1", "Status should be Submitted (1)");
  });

  it("2.2: should emit TaskSubmitted event on task submission", async function () {
    const txCreate = await escrowTask.connect(client).createTask(githubPrUrl, { value: rewardAmount });
    await txCreate.wait();

    const prUrlSubmit = "https://github.com/test/repo/pull/1/submit";
    const txSubmit = await escrowTask.connect(developer).submitTask(1, prUrlSubmit);
    const receipt = await txSubmit.wait();

    const eventLogs = getEventLogs(receipt, "TaskSubmitted", escrowTask.interface);
    assert.strictEqual(eventLogs.length, 1, "Should emit exactly one TaskSubmitted event");

    const eventArgs = eventLogs[0].args;
    const taskId = eventArgs[0] !== undefined ? eventArgs[0] : eventArgs.taskId;
    const eventDev = eventArgs[1] !== undefined ? eventArgs[1] : eventArgs.developer;
    const eventUrl = eventArgs[2] !== undefined ? eventArgs[2] : eventArgs.githubPrUrl;

    const developerAddress = await developer.getAddress();
    assert.strictEqual(taskId.toString(), "1", "Task ID should be 1");
    assert.strictEqual(eventDev.toLowerCase(), developerAddress.toLowerCase(), "Developer address should match");
    assert.strictEqual(eventUrl, prUrlSubmit, "PR URL should match submitted PR");
  });

  it("2.3: should revert PR submission when client attempts to submit to their own task", async function () {
    const txCreate = await escrowTask.connect(client).createTask(githubPrUrl, { value: rewardAmount });
    await txCreate.wait();

    await assertRevert(
      escrowTask.connect(client).submitTask(1, "https://github.com/test/repo/pull/1/client"),
      "Client cannot complete their own task"
    );
  });

  it("2.4: should allow developer to update PR URL before task approval", async function () {
    const txCreate = await escrowTask.connect(client).createTask(githubPrUrl, { value: rewardAmount });
    await txCreate.wait();

    const txSubmit1 = await escrowTask.connect(developer).submitTask(1, "url-v1");
    await txSubmit1.wait();

    const txSubmit2 = await escrowTask.connect(developer).submitTask(1, "url-v2");
    await txSubmit2.wait();

    const details = await escrowTask.getTaskDetails(1);
    assert.strictEqual(details.githubPrUrl, "url-v2", "PR URL should be updated to url-v2");
    assert.strictEqual(details.status.toString(), "1", "Status should remain Submitted (1)");
  });

  it("2.5: should revert PR submission from a different developer if already submitted by another", async function () {
    const txCreate = await escrowTask.connect(client).createTask(githubPrUrl, { value: rewardAmount });
    await txCreate.wait();

    const txSubmit1 = await escrowTask.connect(developer).submitTask(1, "url-dev-1");
    await txSubmit1.wait();

    await assertRevert(
      escrowTask.connect(thirdParty).submitTask(1, "url-dev-2"),
      "Task already submitted by another developer"
    );
  });

  it("2.6: should revert PR submission for a non-existent task", async function () {
    await assertRevert(
      escrowTask.connect(developer).submitTask(999, "url"),
      "Task does not exist"
    );
  });

  // ==========================================
  // CORE FEATURE 3: Task Approval/Payment (6 tests)
  // ==========================================

  it("3.1: should successfully approve task and transition state", async function () {
    const txCreate = await escrowTask.connect(client).createTask(githubPrUrl, { value: rewardAmount });
    await txCreate.wait();

    const txSubmit = await escrowTask.connect(developer).submitTask(1, "url-dev-1");
    await txSubmit.wait();

    const txApprove = await escrowTask.connect(client).approveTask(1);
    await txApprove.wait();

    const details = await escrowTask.getTaskDetails(1);
    assert.strictEqual(details.status.toString(), "2", "Status should be Approved (2)");
  });

  it("3.2: should emit TaskApproved event on task approval", async function () {
    const txCreate = await escrowTask.connect(client).createTask(githubPrUrl, { value: rewardAmount });
    await txCreate.wait();

    const txSubmit = await escrowTask.connect(developer).submitTask(1, "url-dev-1");
    await txSubmit.wait();

    const txApprove = await escrowTask.connect(client).approveTask(1);
    const receipt = await txApprove.wait();

    const eventLogs = getEventLogs(receipt, "TaskApproved", escrowTask.interface);
    assert.strictEqual(eventLogs.length, 1, "Should emit exactly one TaskApproved event");

    const eventArgs = eventLogs[0].args;
    const taskId = eventArgs[0] !== undefined ? eventArgs[0] : eventArgs.taskId;
    const eventDev = eventArgs[1] !== undefined ? eventArgs[1] : eventArgs.developer;
    const eventReward = eventArgs[2] !== undefined ? eventArgs[2] : eventArgs.reward;

    const developerAddress = await developer.getAddress();
    assert.strictEqual(taskId.toString(), "1", "Task ID should be 1");
    assert.strictEqual(eventDev.toLowerCase(), developerAddress.toLowerCase(), "Developer address should match");
    assert.strictEqual(eventReward.toString(), rewardAmount.toString(), "Reward amount should match");
  });

  it("3.3: should verify contract and developer balance updates on task approval", async function () {
    const txCreate = await escrowTask.connect(client).createTask(githubPrUrl, { value: rewardAmount });
    await txCreate.wait();

    const txSubmit = await escrowTask.connect(developer).submitTask(1, "url-dev-1");
    await txSubmit.wait();

    const developerAddress = await developer.getAddress();
    const devBalanceBefore = await getBalance(developerAddress);
    
    const contractAddr = await getContractAddress(escrowTask);
    const contractBalanceBefore = await getBalance(contractAddr);
    assert.strictEqual(contractBalanceBefore.toString(), rewardAmount.toString(), "Contract should hold reward amount before approval");

    const txApprove = await escrowTask.connect(client).approveTask(1);
    await txApprove.wait();

    const contractBalanceAfter = await getBalance(contractAddr);
    assert.strictEqual(contractBalanceAfter.toString(), "0", "Contract balance should decrease to 0 after approval");

    const devBalanceAfter = await getBalance(developerAddress);
    const expectedDevBalance = devBalanceBefore + rewardAmount;
    assert.strictEqual(devBalanceAfter.toString(), expectedDevBalance.toString(), "Developer balance should increase by exactly reward amount");
  });

  it("3.4: should revert task approval when caller is not the task client", async function () {
    const txCreate = await escrowTask.connect(client).createTask(githubPrUrl, { value: rewardAmount });
    await txCreate.wait();

    const txSubmit = await escrowTask.connect(developer).submitTask(1, "url-dev-1");
    await txSubmit.wait();

    await assertRevert(
      escrowTask.connect(developer).approveTask(1),
      "Only the task client can perform this action"
    );

    await assertRevert(
      escrowTask.connect(thirdParty).approveTask(1),
      "Only the task client can perform this action"
    );
  });

  it("3.5: should revert task approval when task is in Created status (not submitted yet)", async function () {
    const txCreate = await escrowTask.connect(client).createTask(githubPrUrl, { value: rewardAmount });
    await txCreate.wait();

    await assertRevert(
      escrowTask.connect(client).approveTask(1),
      "Task must be submitted by a developer before approval"
    );
  });

  it("3.6: should revert task approval when task is already finalized", async function () {
    const txCreate = await escrowTask.connect(client).createTask(githubPrUrl, { value: rewardAmount });
    await txCreate.wait();

    const txSubmit = await escrowTask.connect(developer).submitTask(1, "url-dev-1");
    await txSubmit.wait();

    const txApprove = await escrowTask.connect(client).approveTask(1);
    await txApprove.wait();

    await assertRevert(
      escrowTask.connect(client).approveTask(1),
      "Task is already finalized"
    );
  });

  // ==========================================
  // CORE FEATURE 4: Task Cancellation (6 tests)
  // ==========================================

  it("4.1: should successfully cancel a task in Created status", async function () {
    const txCreate = await escrowTask.connect(client).createTask(githubPrUrl, { value: rewardAmount });
    await txCreate.wait();

    const txCancel = await escrowTask.connect(client).cancelTask(1);
    await txCancel.wait();

    const details = await escrowTask.getTaskDetails(1);
    assert.strictEqual(details.status.toString(), "3", "Status should be Cancelled (3)");
  });

  it("4.2: should successfully cancel a task in Submitted status", async function () {
    const txCreate = await escrowTask.connect(client).createTask(githubPrUrl, { value: rewardAmount });
    await txCreate.wait();

    const txSubmit = await escrowTask.connect(developer).submitTask(1, "url-dev-1");
    await txSubmit.wait();

    const txCancel = await escrowTask.connect(client).cancelTask(1);
    await txCancel.wait();

    const details = await escrowTask.getTaskDetails(1);
    assert.strictEqual(details.status.toString(), "3", "Status should be Cancelled (3)");
  });

  it("4.3: should emit TaskCancelled event on task cancellation", async function () {
    const txCreate = await escrowTask.connect(client).createTask(githubPrUrl, { value: rewardAmount });
    await txCreate.wait();

    const txCancel = await escrowTask.connect(client).cancelTask(1);
    const receipt = await txCancel.wait();

    const eventLogs = getEventLogs(receipt, "TaskCancelled", escrowTask.interface);
    assert.strictEqual(eventLogs.length, 1, "Should emit exactly one TaskCancelled event");

    const eventArgs = eventLogs[0].args;
    const taskId = eventArgs[0] !== undefined ? eventArgs[0] : eventArgs.taskId;
    const eventRefund = eventArgs[1] !== undefined ? eventArgs[1] : eventArgs.refundAmount;

    assert.strictEqual(taskId.toString(), "1", "Task ID should be 1");
    assert.strictEqual(eventRefund.toString(), rewardAmount.toString(), "Refund amount should match reward");
  });

  it("4.4: should verify contract and client balance updates on task cancellation", async function () {
    const txCreate = await escrowTask.connect(client).createTask(githubPrUrl, { value: rewardAmount });
    await txCreate.wait();

    const clientAddress = await client.getAddress();
    const clientBalanceBefore = await getBalance(clientAddress);
    
    const contractAddr = await getContractAddress(escrowTask);
    const contractBalanceBefore = await getBalance(contractAddr);
    assert.strictEqual(contractBalanceBefore.toString(), rewardAmount.toString(), "Contract should hold reward amount before cancellation");

    const txCancel = await escrowTask.connect(client).cancelTask(1);
    const receipt = await txCancel.wait();

    const contractBalanceAfter = await getBalance(contractAddr);
    assert.strictEqual(contractBalanceAfter.toString(), "0", "Contract balance should decrease to 0 after cancellation");

    const clientBalanceAfter = await getBalance(clientAddress);
    const gasUsed = toBigInt(receipt.gasUsed);
    const gasPrice = toBigInt(receipt.effectiveGasPrice || txCancel.gasPrice || receipt.gasPrice || 0);
    const gasCost = gasUsed * gasPrice;

    const expectedClientBalance = clientBalanceBefore + rewardAmount - gasCost;
    assert.strictEqual(clientBalanceAfter.toString(), expectedClientBalance.toString(), "Client balance should be refunded reward amount minus gas fees");
  });

  it("4.5: should revert task cancellation when caller is not the task client", async function () {
    const txCreate = await escrowTask.connect(client).createTask(githubPrUrl, { value: rewardAmount });
    await txCreate.wait();

    await assertRevert(
      escrowTask.connect(developer).cancelTask(1),
      "Only the task client can perform this action"
    );

    await assertRevert(
      escrowTask.connect(thirdParty).cancelTask(1),
      "Only the task client can perform this action"
    );
  });

  it("4.6: should revert task cancellation when task is already finalized", async function () {
    const txCreate = await escrowTask.connect(client).createTask(githubPrUrl, { value: rewardAmount });
    await txCreate.wait();

    const txSubmit = await escrowTask.connect(developer).submitTask(1, "url-dev-1");
    await txSubmit.wait();

    // Finalize via approval
    const txApprove = await escrowTask.connect(client).approveTask(1);
    await txApprove.wait();

    await assertRevert(
      escrowTask.connect(client).cancelTask(1),
      "Task is already finalized"
    );
  });
});
