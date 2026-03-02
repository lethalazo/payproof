import { parseAbi } from "viem";

export const HTLC_ABI = parseAbi([
  "function lock(bytes32 lockId, address recipient, address token, uint256 amount, bytes32 hashlock, uint256 timelock) external",
  "function postDataHash(bytes32 lockId, bytes32 dataHash) external",
  "function confirmReceipt(bytes32 lockId, bytes32 receiptHash) external",
  "function claim(bytes32 lockId, bytes32 preimage) external",
  "function refund(bytes32 lockId) external",
  "function sendToTreasury(bytes32 lockId) external",
  "function getLock(bytes32 lockId) view returns ((address sender, address recipient, address token, uint256 amount, bytes32 hashlock, uint256 timelock, uint256 dataDeadline, bytes32 dataHash, bytes32 receiptHash, uint8 state))",
  "function treasury() view returns (address)",
  "function CONFIRMATION_WINDOW() view returns (uint256)",
  "event Locked(bytes32 indexed lockId, address indexed sender, address indexed recipient, bytes32 hashlock, uint256 amount, uint256 timelock)",
  "event DataPosted(bytes32 indexed lockId, bytes32 dataHash, uint256 dataDeadline)",
  "event ReceiptConfirmed(bytes32 indexed lockId, bytes32 receiptHash)",
  "event Claimed(bytes32 indexed lockId, bytes32 preimage)",
  "event Refunded(bytes32 indexed lockId)",
  "event SentToTreasury(bytes32 indexed lockId, address treasury)",
]);

export const REGISTRY_ABI = parseAbi([
  "function getVersion(uint256 version) view returns ((address contractAddress, bool active, uint256 deployedAt))",
  "function getLatestVersion() view returns (uint256, address)",
  "function latestVersion() view returns (uint256)",
]);

export enum LockState {
  Empty = 0,
  Locked = 1,
  DataPosted = 2,
  Confirmed = 3,
  Claimed = 4,
  Refunded = 5,
  Treasury = 6,
}
