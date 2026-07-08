// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "../EscrowTask.sol";

contract ReentrantDeveloper {
    EscrowTask public escrowTask;
    uint256 public taskId;
    string public reenterFunction; // "approveTask" or "cancelTask" or "submitTask"
    bool public hasReentered;
    string public lastError;

    constructor(address _escrowTask) {
        escrowTask = EscrowTask(_escrowTask);
    }

    function setTarget(uint256 _taskId, string memory _reenterFunction) external {
        taskId = _taskId;
        reenterFunction = _reenterFunction;
        hasReentered = false;
        lastError = "";
    }

    function submit(string calldata _prUrl) external {
        escrowTask.submitTask(taskId, _prUrl);
    }

    receive() external payable {
        if (!hasReentered) {
            hasReentered = true;
            if (keccak256(bytes(reenterFunction)) == keccak256(bytes("approveTask"))) {
                try escrowTask.approveTask(taskId) {
                    // Success (should not happen)
                } catch Error(string memory reason) {
                    lastError = reason;
                } catch {
                    lastError = "low-level revert";
                }
            } else if (keccak256(bytes(reenterFunction)) == keccak256(bytes("cancelTask"))) {
                try escrowTask.cancelTask(taskId) {
                    // Success (should not happen)
                } catch Error(string memory reason) {
                    lastError = reason;
                } catch {
                    lastError = "low-level revert";
                }
            } else if (keccak256(bytes(reenterFunction)) == keccak256(bytes("submitTask"))) {
                try escrowTask.submitTask(taskId, "https://github.com/reenter") {
                    // Success (should not happen)
                } catch Error(string memory reason) {
                    lastError = reason;
                } catch {
                    lastError = "low-level revert";
                }
            }
        }
    }
}

contract ReentrantClient {
    EscrowTask public escrowTask;
    uint256 public taskId;
    string public reenterFunction; // "approveTask" or "cancelTask"
    bool public hasReentered;
    string public lastError;

    constructor(address _escrowTask) {
        escrowTask = EscrowTask(_escrowTask);
    }

    function setTarget(uint256 _taskId, string memory _reenterFunction) external {
        taskId = _taskId;
        reenterFunction = _reenterFunction;
        hasReentered = false;
        lastError = "";
    }

    function createTask(string calldata _prUrl) external payable {
        escrowTask.createTask{value: msg.value}(_prUrl);
    }

    function cancel() external {
        escrowTask.cancelTask(taskId);
    }

    receive() external payable {
        if (!hasReentered) {
            hasReentered = true;
            if (keccak256(bytes(reenterFunction)) == keccak256(bytes("cancelTask"))) {
                try escrowTask.cancelTask(taskId) {
                    // Success (should not happen)
                } catch Error(string memory reason) {
                    lastError = reason;
                } catch {
                    lastError = "low-level revert";
                }
            } else if (keccak256(bytes(reenterFunction)) == keccak256(bytes("approveTask"))) {
                try escrowTask.approveTask(taskId) {
                    // Success (should not happen)
                } catch Error(string memory reason) {
                    lastError = reason;
                } catch {
                    lastError = "low-level revert";
                }
            }
        }
    }
}

contract DoSDeveloper {
    EscrowTask public escrowTask;
    uint256 public taskId;

    constructor(address _escrowTask) {
        escrowTask = EscrowTask(_escrowTask);
    }

    function submit(uint256 _taskId, string calldata _prUrl) external {
        taskId = _taskId;
        escrowTask.submitTask(_taskId, _prUrl);
    }

    receive() external payable {
        revert("Rejecting ETH");
    }

    fallback() external payable {
        revert("Rejecting ETH");
    }
}

contract DoSClient {
    EscrowTask public escrowTask;

    constructor(address _escrowTask) {
        escrowTask = EscrowTask(_escrowTask);
    }

    function createTask(string calldata _prUrl) external payable {
        escrowTask.createTask{value: msg.value}(_prUrl);
    }

    function cancel(uint256 _taskId) external {
        escrowTask.cancelTask(_taskId);
    }

    receive() external payable {
        revert("Rejecting ETH");
    }

    fallback() external payable {
        revert("Rejecting ETH");
    }
}
