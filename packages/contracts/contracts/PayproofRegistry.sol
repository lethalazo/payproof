// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract PayproofRegistry {
    struct Version {
        address contractAddress;
        bool active;
        uint256 deployedAt;
    }

    mapping(uint256 => Version) public versions;
    uint256 public latestVersion;
    address public owner;

    event VersionRegistered(uint256 indexed version, address contractAddress);
    event VersionDeactivated(uint256 indexed version);

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function registerVersion(uint256 version, address contractAddress) external onlyOwner {
        require(contractAddress != address(0), "zero address");
        require(versions[version].contractAddress == address(0), "version exists");
        versions[version] = Version(contractAddress, true, block.timestamp);
        if (version > latestVersion) {
            latestVersion = version;
        }
        emit VersionRegistered(version, contractAddress);
    }

    function deactivateVersion(uint256 version) external onlyOwner {
        require(versions[version].contractAddress != address(0), "version not found");
        versions[version].active = false;
        emit VersionDeactivated(version);
    }

    function getVersion(uint256 version) external view returns (Version memory) {
        return versions[version];
    }

    function getLatestVersion() external view returns (uint256, address) {
        return (latestVersion, versions[latestVersion].contractAddress);
    }
}
