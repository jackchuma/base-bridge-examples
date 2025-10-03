import { createPublicClient, http, type Address } from "viem";
import { baseSepolia } from "viem/chains";
import { fetchOutgoingMessage } from "../clients/ts/src/bridge";
import { BRIDGE_ABI } from "../abis/bridge.abi";
import { sleep } from "bun";
import { createSolanaRpc, type Address as SolAddress } from "@solana/kit";
import { buildEvmMessage } from "./buildEvmMessage";

export async function monitorMessageExecution(
  solRpcUrl: string,
  bridgeContract: Address,
  outgoingMessagePubkey: SolAddress
) {
  console.log("Monitoring message execution...");

  const solRpc = createSolanaRpc(`https://${solRpcUrl}`);
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(),
  });

  const outgoing = await fetchOutgoingMessage(solRpc, outgoingMessagePubkey);
  const { innerHash, outerHash } = buildEvmMessage(outgoing);
  console.log(`Computed inner hash: ${innerHash}`);
  console.log(`Computed outer hash: ${outerHash}`);

  while (true) {
    console.log(`Waiting for automatic relay of message ${outerHash}...`);

    const isSuccessful = await publicClient.readContract({
      address: bridgeContract,
      abi: BRIDGE_ABI,
      functionName: "successes",
      args: [outerHash],
    });

    if (isSuccessful) {
      console.log("Message relayed successfully.");
      return;
    }

    await sleep(10_000);
  }
}
