# Project: Decentralized Task Coordination & Escrow Payment Protocol

## Architecture
The system consists of three main parts:
1. **Smart Contract Backend**: A Solidity contract (`EscrowTask.sol`) running on a local Hardhat network that handles task state management, locks client funds, allows developers to claim tasks with PR URLs, and handles approval/cancellation.
2. **Next.js Frontend**: A Next.js web interface inside `frontend/` that connects to the browser wallet (e.g. MetaMask) and interfaces with the deployed `EscrowTask` contract via `ethers.js` on localhost network.
3. **E2E Testing Track**: An independent requirement-driven, opaque-box E2E test suite running against the local network and deployed contract.

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| E2E-1 | E2E Test Infra & cases | Test runner and 4-tier E2E tests checking feature coverage, edge cases, cross-features, real-world scenarios. Outputs `TEST_READY.md` and `TEST_INFRA.md`. | None | PLANNED |
| 1 | Contract Comp & Tests | Initialize Hardhat in `defitask_project/`, compile `EscrowTask.sol`, write unit tests, verify `scripts/deploy.js`. | None | PLANNED |
| 2 | Frontend Setup & Wallet | Initialize Next.js in `frontend/`, configure local network connection, implement wallet connect & balance display. | Milestone 1 | PLANNED |
| 3 | Frontend DApp Integration | Connect frontend components to contract calls (dashboard list, create task with ETH, submit PR, client approve/cancel). | Milestone 2 | PLANNED |
| 4 | E2E Integration & Tier 5 | Run E2E test suite against full-stack, and perform Tier 5 white-box adversarial coverage hardening. | E2E-1, Milestone 3 | PLANNED |

## Code Layout
- `defitask_project/contracts/EscrowTask.sol` — Solidity smart contract source
- `defitask_project/scripts/deploy.js` — Hardhat deployment script
- `defitask_project/test/` — Smart contract JS unit tests (to be created)
- `defitask_project/frontend/` — Next.js frontend application (to be created)
- `defitask_project/e2e/` — E2E test files and runner (to be created)

## Interface Contracts
### EscrowTask Smart Contract ABI
- **createTask(string _githubPrUrl) external payable returns (uint256)**: Locks msg.value in task. Client is msg.sender. Status becomes `Created (0)`.
- **submitTask(uint256 _taskId, string _githubPrUrl) external**: Developer is msg.sender. Rejects if developer is the client. Status becomes `Submitted (1)`.
- **approveTask(uint256 _taskId) external**: Revisions checks, sends reward value to developer. Client only. Status becomes `Approved (2)`.
- **cancelTask(uint256 _taskId) external**: Refunds reward value to client. Client only. Status becomes `Cancelled (3)`.
- **getTaskDetails(uint256 _taskId) external view returns (address client, address developer, uint256 reward, string memory githubPrUrl, TaskStatus status)**

### TaskStatus Enum mapping:
- `0` -> Created
- `1` -> Submitted
- `2` -> Approved
- `3` -> Cancelled
