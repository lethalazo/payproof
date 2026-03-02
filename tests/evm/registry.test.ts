import { describe, it, expect } from "vitest";
import { REGISTRY_ABI } from "@payproof/contracts";
import { getArcPublicClient, HTLC_ADDRESS, REGISTRY_ADDRESS } from "../helpers.js";

describe("PayproofRegistry on-chain", () => {
  const publicClient = getArcPublicClient();

  it("getVersion(1) returns HTLC address and active=true", async () => {
    const result = await publicClient.readContract({
      address: REGISTRY_ADDRESS(),
      abi: REGISTRY_ABI,
      functionName: "getVersion",
      args: [1n],
    });

    const version = result as unknown as {
      contractAddress: string;
      active: boolean;
      deployedAt: bigint;
    };

    expect(version.contractAddress.toLowerCase()).toBe(HTLC_ADDRESS().toLowerCase());
    expect(version.active).toBe(true);
    expect(version.deployedAt).toBeGreaterThan(0n);
  }, 30_000);

  it("getLatestVersion returns (1, HTLC_ADDRESS)", async () => {
    const result = await publicClient.readContract({
      address: REGISTRY_ADDRESS(),
      abi: REGISTRY_ABI,
      functionName: "getLatestVersion",
    });

    const [versionNum, contractAddr] = result as [bigint, string];
    expect(versionNum).toBe(1n);
    expect(contractAddr.toLowerCase()).toBe(HTLC_ADDRESS().toLowerCase());
  }, 30_000);
});
