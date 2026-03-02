// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transferFrom(address, address, uint256) external returns (bool);
    function transfer(address, uint256) external returns (bool);
}

contract HTLC {
    enum State { Empty, Locked, DataPosted, Confirmed, Claimed, Refunded, Treasury }

    struct Lock {
        address sender;       // agent
        address recipient;    // merchant
        address token;
        uint256 amount;
        bytes32 hashlock;
        uint256 timelock;
        uint256 dataDeadline; // set when postDataHash is called
        bytes32 dataHash;     // merchant's submission proof
        bytes32 receiptHash;  // agent's receipt confirmation
        State state;
    }

    uint256 public constant CONFIRMATION_WINDOW = 120;
    address public immutable treasury;

    mapping(bytes32 => Lock) public locks;

    event Locked(bytes32 indexed lockId, address indexed sender, address indexed recipient, bytes32 hashlock, uint256 amount, uint256 timelock);
    event DataPosted(bytes32 indexed lockId, bytes32 dataHash, uint256 dataDeadline);
    event ReceiptConfirmed(bytes32 indexed lockId, bytes32 receiptHash);
    event Claimed(bytes32 indexed lockId, bytes32 preimage);
    event Refunded(bytes32 indexed lockId);
    event SentToTreasury(bytes32 indexed lockId, address treasury);

    constructor(address _treasury) {
        require(_treasury != address(0), "zero treasury");
        treasury = _treasury;
    }

    function lock(bytes32 lockId, address recipient, address token, uint256 amount, bytes32 hashlock, uint256 timelock) external {
        require(locks[lockId].state == State.Empty, "exists");
        require(amount > 0 && timelock > block.timestamp && recipient != address(0));
        IERC20(token).transferFrom(msg.sender, address(this), amount);
        locks[lockId] = Lock(msg.sender, recipient, token, amount, hashlock, timelock, 0, bytes32(0), bytes32(0), State.Locked);
        emit Locked(lockId, msg.sender, recipient, hashlock, amount, timelock);
    }

    function postDataHash(bytes32 lockId, bytes32 _dataHash) external {
        Lock storage l = locks[lockId];
        require(l.state == State.Locked, "not locked");
        require(msg.sender == l.recipient, "not recipient");
        require(block.timestamp < l.timelock, "expired");
        l.dataHash = _dataHash;
        l.dataDeadline = block.timestamp + CONFIRMATION_WINDOW;
        l.state = State.DataPosted;
        emit DataPosted(lockId, _dataHash, l.dataDeadline);
    }

    function confirmReceipt(bytes32 lockId, bytes32 _receiptHash) external {
        Lock storage l = locks[lockId];
        require(l.state == State.DataPosted, "not data posted");
        require(msg.sender == l.sender, "not sender");
        require(block.timestamp < l.dataDeadline, "deadline passed");
        require(_receiptHash == l.dataHash, "hash mismatch");
        l.receiptHash = _receiptHash;
        l.state = State.Confirmed;
        emit ReceiptConfirmed(lockId, _receiptHash);
    }

    function claim(bytes32 lockId, bytes32 preimage) external {
        Lock storage l = locks[lockId];
        require(l.state == State.Confirmed, "not confirmed");
        require(sha256(abi.encodePacked(preimage)) == l.hashlock, "bad preimage");
        l.state = State.Claimed;
        IERC20(l.token).transfer(l.recipient, l.amount);
        emit Claimed(lockId, preimage);
    }

    function refund(bytes32 lockId) external {
        Lock storage l = locks[lockId];
        require(l.state == State.Locked, "not locked");
        require(block.timestamp >= l.timelock, "not expired");
        l.state = State.Refunded;
        IERC20(l.token).transfer(l.sender, l.amount);
        emit Refunded(lockId);
    }

    function sendToTreasury(bytes32 lockId) external {
        Lock storage l = locks[lockId];
        require(l.state == State.DataPosted, "not data posted");
        require(block.timestamp >= l.dataDeadline, "deadline not passed");
        l.state = State.Treasury;
        IERC20(l.token).transfer(treasury, l.amount);
        emit SentToTreasury(lockId, treasury);
    }

    function getLock(bytes32 lockId) external view returns (Lock memory) {
        return locks[lockId];
    }
}
