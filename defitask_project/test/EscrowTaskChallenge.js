const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("EscrowTask Challenge Tests", function () {
  let EscrowTask;
  let escrowTask;
  let owner;
  let client;
  let developer;
  let otherAccount;

  beforeEach(async function () {
    // Get signers
    [owner, client, developer, otherAccount] = await ethers.getSigners();

    // Deploy main contract
    EscrowTask = await ethers.getContractFactory("EscrowTask");
    escrowTask = await EscrowTask.deploy();
    await escrowTask.waitForDeployment();
  });

  describe("Reentrancy Resistance", function () {
    let reentrantDeveloper;
    let reentrantClient;
    let taskId;
    const reward = ethers.parseEther("1.0");

    beforeEach(async function () {
      // Deploy Reentrant contracts
      const ReentrantDeveloper = await ethers.getContractFactory("ReentrantDeveloper");
      reentrantDeveloper = await ReentrantDeveloper.deploy(await escrowTask.getAddress());
      await reentrantDeveloper.waitForDeployment();

      const ReentrantClient = await ethers.getContractFactory("ReentrantClient");
      reentrantClient = await ReentrantClient.deploy(await escrowTask.getAddress());
      await reentrantClient.waitForDeployment();

      // Create a standard task for developer tests
      const tx = await escrowTask.connect(client).createTask("https://github.com/test/repo/pull/1", { value: reward });
      await tx.wait();
      taskId = 1;
    });

    it("Should prevent Developer contract from reentering approveTask", async function () {
      // Developer submits work
      await reentrantDeveloper.connect(developer).setTarget(taskId, "approveTask");
      await reentrantDeveloper.connect(developer).submit("https://github.com/test/repo/pull/1-completion");

      // Client approves task. This triggers the developer's receive fallback which attempts reentrancy.
      await escrowTask.connect(client).approveTask(taskId);

      // Verify reentrancy failed (lastError should not be empty, meaning it caught a revert)
      const lastError = await reentrantDeveloper.lastError();
      const hasReentered = await reentrantDeveloper.hasReentered();

      expect(hasReentered).to.be.true;
      expect(lastError).to.contain("Only the task client can perform this action");
    });

    it("Should prevent Developer contract from reentering cancelTask", async function () {
      await reentrantDeveloper.connect(developer).setTarget(taskId, "cancelTask");
      await reentrantDeveloper.connect(developer).submit("https://github.com/test/repo/pull/1-completion");

      await escrowTask.connect(client).approveTask(taskId);

      const lastError = await reentrantDeveloper.lastError();
      const hasReentered = await reentrantDeveloper.hasReentered();

      expect(hasReentered).to.be.true;
      expect(lastError).to.contain("Only the task client can perform this action");
    });

    it("Should prevent Developer contract from reentering submitTask", async function () {
      await reentrantDeveloper.connect(developer).setTarget(taskId, "submitTask");
      await reentrantDeveloper.connect(developer).submit("https://github.com/test/repo/pull/1-completion");

      await escrowTask.connect(client).approveTask(taskId);

      const lastError = await reentrantDeveloper.lastError();
      const hasReentered = await reentrantDeveloper.hasReentered();

      expect(hasReentered).to.be.true;
      expect(lastError).to.contain("Task is already finalized");
    });

    it("Should prevent Client contract from reentering cancelTask", async function () {
      // Client contract creates a task
      const tx = await reentrantClient.connect(client).createTask("https://github.com/test/repo/pull/2", { value: reward });
      await tx.wait();
      const clientTaskId = 2;

      // Set target on client to attempt cancelTask reentrancy when refunded
      await reentrantClient.connect(client).setTarget(clientTaskId, "cancelTask");

      // Client contract cancels task (receives refund, triggers reentrancy)
      await reentrantClient.connect(client).cancel();

      const lastError = await reentrantClient.lastError();
      const hasReentered = await reentrantClient.hasReentered();

      expect(hasReentered).to.be.true;
      expect(lastError).to.contain("Task is already finalized");
    });

    it("Should prevent Client contract from reentering approveTask", async function () {
      const tx = await reentrantClient.connect(client).createTask("https://github.com/test/repo/pull/3", { value: reward });
      await tx.wait();
      const clientTaskId = 2; // Tasks count is 2 since 1 was created in beforeEach, and clientTaskId = 2 now

      await reentrantClient.connect(client).setTarget(clientTaskId, "approveTask");

      await reentrantClient.connect(client).cancel();

      const lastError = await reentrantClient.lastError();
      const hasReentered = await reentrantClient.hasReentered();

      expect(hasReentered).to.be.true;
      expect(lastError).to.contain("Task is already finalized");
    });
  });

  describe("DoS Conditions", function () {
    let dosDeveloper;
    let dosClient;
    let taskId;
    const reward = ethers.parseEther("1.0");

    beforeEach(async function () {
      const DoSDeveloper = await ethers.getContractFactory("DoSDeveloper");
      dosDeveloper = await DoSDeveloper.deploy(await escrowTask.getAddress());
      await dosDeveloper.waitForDeployment();

      const DoSClient = await ethers.getContractFactory("DoSClient");
      dosClient = await DoSClient.deploy(await escrowTask.getAddress());
      await dosClient.waitForDeployment();

      const tx = await escrowTask.connect(client).createTask("https://github.com/test/repo/pull/1", { value: reward });
      await tx.wait();
      taskId = 1;
    });

    it("Should revert approveTask if Developer contract rejects ETH", async function () {
      // DoS Developer submits work
      await dosDeveloper.connect(developer).submit(taskId, "https://github.com/test/repo/pull/1-completion");

      // Client attempts to approve, should revert because Developer rejects ETH
      await expect(
        escrowTask.connect(client).approveTask(taskId)
      ).to.be.revertedWith("ETH transfer failed");
    });

    it("Should revert cancelTask if Client contract rejects ETH", async function () {
      // DoS Client creates task
      const tx = await dosClient.connect(client).createTask("https://github.com/test/repo/pull/2", { value: reward });
      await tx.wait();
      const clientTaskId = 2;

      // Client attempts to cancel, should revert because Client rejects ETH
      await expect(
        dosClient.connect(client).cancel(clientTaskId)
      ).to.be.revertedWith("Refund transfer failed");
    });
  });

  describe("Task ID Boundaries and Value Limits", function () {
    const reward = ethers.parseEther("1.0");

    beforeEach(async function () {
      const tx = await escrowTask.connect(client).createTask("https://github.com/test/repo/pull/1", { value: reward });
      await tx.wait();
    });

    it("Should fail to create a task with zero value", async function () {
      await expect(
        escrowTask.connect(client).createTask("https://github.com/test/repo/pull/1", { value: 0n })
      ).to.be.revertedWith("Reward amount must be greater than zero");
    });

    it("Should revert when trying to approve a task ID of 0", async function () {
      // Only the client of task 0 (which is address(0)) can approve.
      // Since address(0) cannot call the function, it should fail.
      await expect(
        escrowTask.connect(client).approveTask(0)
      ).to.be.revertedWith("Only the task client can perform this action");
    });

    it("Should revert when trying to cancel a task ID of 0", async function () {
      await expect(
        escrowTask.connect(client).cancelTask(0)
      ).to.be.revertedWith("Only the task client can perform this action");
    });

    it("Should revert when trying to approve a non-existent task ID > tasksCount", async function () {
      await expect(
        escrowTask.connect(client).approveTask(999)
      ).to.be.revertedWith("Only the task client can perform this action");
    });

    it("Should revert when trying to cancel a non-existent task ID > tasksCount", async function () {
      await expect(
        escrowTask.connect(client).cancelTask(999)
      ).to.be.revertedWith("Only the task client can perform this action");
    });

    it("Adversarial behavior: Should revert when submitting to task ID of 0", async function () {
      const submitPrUrl = "https://github.com/test/repo/pull/0-submission";
      
      await expect(
        escrowTask.connect(developer).submitTask(0, submitPrUrl)
      ).to.be.revertedWith("Task does not exist");

      // Verify that the mapping for task 0 was not updated
      const task = await escrowTask.tasks(0);
      expect(task.developer).to.equal(ethers.ZeroAddress);
      expect(task.status).to.equal(0); // Created
    });

    it("Adversarial behavior: Should revert when submitting to non-existent task ID > tasksCount", async function () {
      const submitPrUrl = "https://github.com/test/repo/pull/999-submission";
      
      await expect(
        escrowTask.connect(developer).submitTask(999, submitPrUrl)
      ).to.be.revertedWith("Task does not exist");

      const task = await escrowTask.tasks(999);
      expect(task.developer).to.equal(ethers.ZeroAddress);
      expect(task.status).to.equal(0); // Created
    });
  });
});
