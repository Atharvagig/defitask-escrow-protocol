// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title EscrowTask
 * @dev A smart contract for locking funds in escrow and releasing them upon verified task completion.
 * Perfect for Web3 project taskboards and freelance software engineering.
 */
contract EscrowTask {
    
    enum TaskStatus { Created, Submitted, Approved, Cancelled }

    struct Task {
        uint256 id;
        address payable client;
        address payable developer;
        uint256 reward;
        string githubPrUrl;
        TaskStatus status;
    }

    uint256 public tasksCount;
    mapping(uint256 => Task) public tasks;
    address public contractOwner;

    // Events for dashboard indexers (like The Graph or custom node listeners)
    event TaskCreated(uint256 indexed taskId, address indexed client, uint256 reward, string githubPrUrl);
    event TaskSubmitted(uint256 indexed taskId, address indexed developer, string githubPrUrl);
    event TaskApproved(uint256 indexed taskId, address indexed developer, uint256 reward);
    event TaskCancelled(uint256 indexed taskId, uint256 refundAmount);

    modifier onlyClient(uint256 _taskId) {
        require(msg.sender == tasks[_taskId].client, "Only the task client can perform this action");
        _;
    }

    modifier taskActive(uint256 _taskId) {
        require(tasks[_taskId].status == TaskStatus.Created || tasks[_taskId].status == TaskStatus.Submitted, "Task is already finalized");
        _;
    }

    constructor() {
        contractOwner = msg.sender;
    }

    /**
     * @notice Allows a client to register a task and deposit reward funds in escrow.
     * @param _githubPrUrl Placeholder URL or description of task specifications.
     */
    function createTask(string calldata _githubPrUrl) external payable returns (uint256) {
        require(msg.value > 0, "Reward amount must be greater than zero");
        
        tasksCount++;
        
        tasks[tasksCount] = Task({
            id: tasksCount,
            client: payable(msg.sender),
            developer: payable(address(0)), // Initialized as empty
            reward: msg.value,
            githubPrUrl: _githubPrUrl,
            status: TaskStatus.Created
        });

        emit TaskCreated(tasksCount, msg.sender, msg.value, _githubPrUrl);
        return tasksCount;
    }

    /**
     * @notice Allows a developer to submit their work by assigning themselves and linking their Pull Request.
     * @param _taskId ID of the target task.
     * @param _githubPrUrl The GitHub PR link proving completion.
     */
    function submitTask(uint256 _taskId, string calldata _githubPrUrl) external taskActive(_taskId) {
        require(_taskId > 0 && _taskId <= tasksCount, "Task does not exist");
        Task storage task = tasks[_taskId];
        
        require(task.client != msg.sender, "Client cannot complete their own task");
        require(task.developer == address(0) || task.developer == msg.sender, "Task already submitted by another developer");
        
        task.developer = payable(msg.sender);
        task.githubPrUrl = _githubPrUrl;
        task.status = TaskStatus.Submitted;

        emit TaskSubmitted(_taskId, msg.sender, _githubPrUrl);
    }

    /**
     * @notice Allows the client to review the work and release the escrowed reward to the developer.
     * @param _taskId ID of the approved task.
     */
    function approveTask(uint256 _taskId) external onlyClient(_taskId) taskActive(_taskId) {
        Task storage task = tasks[_taskId];
        
        require(task.status == TaskStatus.Submitted, "Task must be submitted by a developer before approval");
        require(task.developer != address(0), "Developer address cannot be empty");

        task.status = TaskStatus.Approved;
        uint256 payment = task.reward;
        
        // Transfer reward funds to the developer
        (bool success, ) = task.developer.call{value: payment}("");
        require(success, "ETH transfer failed");

        emit TaskApproved(_taskId, task.developer, payment);
    }

    /**
     * @notice Allows the client to cancel the task and retrieve the escrowed deposit (only if task is not approved).
     * @param _taskId ID of the cancelled task.
     */
    function cancelTask(uint256 _taskId) external onlyClient(_taskId) taskActive(_taskId) {
        Task storage task = tasks[_taskId];
        
        task.status = TaskStatus.Cancelled;
        uint256 refund = task.reward;
        
        // Return funds to client
        (bool success, ) = task.client.call{value: refund}("");
        require(success, "Refund transfer failed");

        emit TaskCancelled(_taskId, refund);
    }

    /**
     * @notice Returns details of a specific task.
     */
    function getTaskDetails(uint256 _taskId) external view returns (
        address client,
        address developer,
        uint256 reward,
        string memory githubPrUrl,
        TaskStatus status
    ) {
        Task memory task = tasks[_taskId];
        return (task.client, task.developer, task.reward, task.githubPrUrl, task.status);
    }
}
