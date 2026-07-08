const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("EscrowTask", function () {
  let EscrowTask;
  let escrowTask;
  let owner;
  let client;
  let developer;
  let otherAccount;

  beforeEach(async function () {
    // Get signers
    [owner, client, developer, otherAccount] = await ethers.getSigners();

    // Deploy contract
    EscrowTask = await ethers.getContractFactory("EscrowTask");
    escrowTask = await EscrowTask.deploy();
    await escrowTask.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the correct contract owner", async function () {
      expect(await escrowTask.contractOwner()).to.equal(owner.address);
    });
  });

  describe("Task Creation", function () {
    it("Should successfully create a task with locked ETH and emit TaskCreated event", async function () {
      const reward = ethers.parseEther("1.0");
      const githubPrUrl = "https://github.com/test/repo/pull/1";

      const tx = await escrowTask.connect(client).createTask(githubPrUrl, { value: reward });
      const receipt = await tx.wait();

      // Check task details
      const task = await escrowTask.tasks(1);
      expect(task.id).to.equal(1);
      expect(task.client).to.equal(client.address);
      expect(task.developer).to.equal(ethers.ZeroAddress);
      expect(task.reward).to.equal(reward);
      expect(task.githubPrUrl).to.equal(githubPrUrl);
      expect(task.status).to.equal(0); // Created

      expect(await escrowTask.tasksCount()).to.equal(1);

      // Check event
      await expect(tx)
        .to.emit(escrowTask, "TaskCreated")
        .withArgs(1, client.address, reward, githubPrUrl);
    });

    it("Should fail to create a task with zero reward", async function () {
      const githubPrUrl = "https://github.com/test/repo/pull/1";
      await expect(
        escrowTask.connect(client).createTask(githubPrUrl, { value: 0 })
      ).to.be.revertedWith("Reward amount must be greater than zero");
    });
  });

  describe("Task Submission", function () {
    let taskId;
    const reward = ethers.parseEther("1.0");
    const initPrUrl = "https://github.com/test/repo/pull/1";

    beforeEach(async function () {
      const tx = await escrowTask.connect(client).createTask(initPrUrl, { value: reward });
      await tx.wait();
      taskId = 1;
    });

    it("Should successfully submit a task and emit TaskSubmitted event", async function () {
      const submitPrUrl = "https://github.com/test/repo/pull/1-completion";
      const tx = await escrowTask.connect(developer).submitTask(taskId, submitPrUrl);
      await tx.wait();

      const task = await escrowTask.tasks(taskId);
      expect(task.developer).to.equal(developer.address);
      expect(task.githubPrUrl).to.equal(submitPrUrl);
      expect(task.status).to.equal(1); // Submitted

      await expect(tx)
        .to.emit(escrowTask, "TaskSubmitted")
        .withArgs(taskId, developer.address, submitPrUrl);
    });

    it("Should prevent client from self-submitting the task", async function () {
      const submitPrUrl = "https://github.com/test/repo/pull/1-completion";
      await expect(
        escrowTask.connect(client).submitTask(taskId, submitPrUrl)
      ).to.be.revertedWith("Client cannot complete their own task");
    });

    it("Should prevent submission on finalized tasks", async function () {
      const submitPrUrl = "https://github.com/test/repo/pull/1-completion";
      
      // Cancel the task to finalize it
      await escrowTask.connect(client).cancelTask(taskId);

      await expect(
        escrowTask.connect(developer).submitTask(taskId, submitPrUrl)
      ).to.be.revertedWith("Task is already finalized");
    });

    it("Should prevent another developer from submitting an already-submitted task", async function () {
      const submitPrUrl1 = "https://github.com/test/repo/pull/1-completion";
      await escrowTask.connect(developer).submitTask(taskId, submitPrUrl1);

      const submitPrUrl2 = "https://github.com/test/repo/pull/1-other-completion";
      await expect(
        escrowTask.connect(otherAccount).submitTask(taskId, submitPrUrl2)
      ).to.be.revertedWith("Task already submitted by another developer");
    });

    it("Should allow the same developer to resubmit a task", async function () {
      const submitPrUrl1 = "https://github.com/test/repo/pull/1-completion";
      await escrowTask.connect(developer).submitTask(taskId, submitPrUrl1);

      const submitPrUrl2 = "https://github.com/test/repo/pull/1-updated";
      await expect(
        escrowTask.connect(developer).submitTask(taskId, submitPrUrl2)
      ).to.not.be.reverted;

      const task = await escrowTask.tasks(taskId);
      expect(task.developer).to.equal(developer.address);
      expect(task.githubPrUrl).to.equal(submitPrUrl2);
    });

    it("Should revert when trying to submit a task ID of 0", async function () {
      const submitPrUrl = "https://github.com/test/repo/pull/0-submission";
      await expect(
        escrowTask.connect(developer).submitTask(0, submitPrUrl)
      ).to.be.revertedWith("Task does not exist");
    });

    it("Should revert when trying to submit a non-existent task ID > tasksCount", async function () {
      const submitPrUrl = "https://github.com/test/repo/pull/999-submission";
      await expect(
        escrowTask.connect(developer).submitTask(999, submitPrUrl)
      ).to.be.revertedWith("Task does not exist");
    });
  });

  describe("Task Approval", function () {
    let taskId;
    const reward = ethers.parseEther("1.0");
    const initPrUrl = "https://github.com/test/repo/pull/1";
    const submitPrUrl = "https://github.com/test/repo/pull/1-completion";

    beforeEach(async function () {
      const tx = await escrowTask.connect(client).createTask(initPrUrl, { value: reward });
      await tx.wait();
      taskId = 1;
    });

    it("Should fail if the task is not yet submitted by a developer", async function () {
      await expect(
        escrowTask.connect(client).approveTask(taskId)
      ).to.be.revertedWith("Task must be submitted by a developer before approval");
    });

    describe("Submitted task approval", function () {
      beforeEach(async function () {
        await escrowTask.connect(developer).submitTask(taskId, submitPrUrl);
      });

      it("Should successfully approve, transfer reward to developer, and emit TaskApproved event", async function () {
        const devBalanceBefore = await ethers.provider.getBalance(developer.address);

        const tx = await escrowTask.connect(client).approveTask(taskId);
        const receipt = await tx.wait();

        const task = await escrowTask.tasks(taskId);
        expect(task.status).to.equal(2); // Approved

        const devBalanceAfter = await ethers.provider.getBalance(developer.address);
        expect(devBalanceAfter - devBalanceBefore).to.equal(reward);

        await expect(tx)
          .to.emit(escrowTask, "TaskApproved")
          .withArgs(taskId, developer.address, reward);
      });

      it("Should fail to approve task if called by non-client", async function () {
        await expect(
          escrowTask.connect(developer).approveTask(taskId)
        ).to.be.revertedWith("Only the task client can perform this action");

        await expect(
          escrowTask.connect(otherAccount).approveTask(taskId)
        ).to.be.revertedWith("Only the task client can perform this action");
      });

      it("Should fail to approve task if it is already finalized (approved)", async function () {
        // Approve task
        await escrowTask.connect(client).approveTask(taskId);

        // Try to approve again
        await expect(
          escrowTask.connect(client).approveTask(taskId)
        ).to.be.revertedWith("Task is already finalized");
      });
    });
  });

  describe("Task Cancellation", function () {
    let taskId;
    const reward = ethers.parseEther("1.0");
    const initPrUrl = "https://github.com/test/repo/pull/1";
    const submitPrUrl = "https://github.com/test/repo/pull/1-completion";

    beforeEach(async function () {
      const tx = await escrowTask.connect(client).createTask(initPrUrl, { value: reward });
      await tx.wait();
      taskId = 1;
    });

    it("Should successfully cancel, refund client, and emit TaskCancelled event", async function () {
      const clientBalanceBefore = await ethers.provider.getBalance(client.address);

      const tx = await escrowTask.connect(client).cancelTask(taskId);
      const receipt = await tx.wait();
      
      // Calculate transaction cost
      const gasUsed = receipt.gasUsed;
      const gasPrice = tx.gasPrice || receipt.gasPrice || 0n;
      const txCost = gasUsed * gasPrice;

      const task = await escrowTask.tasks(taskId);
      expect(task.status).to.equal(3); // Cancelled

      const clientBalanceAfter = await ethers.provider.getBalance(client.address);
      // clientBalanceAfter should be: clientBalanceBefore + reward - txCost
      expect(clientBalanceAfter).to.equal(clientBalanceBefore + reward - txCost);

      await expect(tx)
        .to.emit(escrowTask, "TaskCancelled")
        .withArgs(taskId, reward);
    });

    it("Should fail to cancel task if called by non-client", async function () {
      await expect(
        escrowTask.connect(developer).cancelTask(taskId)
      ).to.be.revertedWith("Only the task client can perform this action");
    });

    it("Should fail to cancel task if it is already finalized (cancelled)", async function () {
      // Cancel once
      await escrowTask.connect(client).cancelTask(taskId);

      // Try to cancel again
      await expect(
        escrowTask.connect(client).cancelTask(taskId)
      ).to.be.revertedWith("Task is already finalized");
    });
  });

  describe("Get Task Details", function () {
    let taskId;
    const reward = ethers.parseEther("1.0");
    const initPrUrl = "https://github.com/test/repo/pull/1";

    beforeEach(async function () {
      const tx = await escrowTask.connect(client).createTask(initPrUrl, { value: reward });
      await tx.wait();
      taskId = 1;
    });

    it("Should return correct details for a newly created task", async function () {
      const details = await escrowTask.getTaskDetails(taskId);
      expect(details.client).to.equal(client.address);
      expect(details.developer).to.equal(ethers.ZeroAddress);
      expect(details.reward).to.equal(reward);
      expect(details.githubPrUrl).to.equal(initPrUrl);
      expect(details.status).to.equal(0); // Created
    });

    it("Should return correct details for a submitted task", async function () {
      const submitPrUrl = "https://github.com/test/repo/pull/1-completion";
      await escrowTask.connect(developer).submitTask(taskId, submitPrUrl);

      const details = await escrowTask.getTaskDetails(taskId);
      expect(details.client).to.equal(client.address);
      expect(details.developer).to.equal(developer.address);
      expect(details.reward).to.equal(reward);
      expect(details.githubPrUrl).to.equal(submitPrUrl);
      expect(details.status).to.equal(1); // Submitted
    });
  });
});
