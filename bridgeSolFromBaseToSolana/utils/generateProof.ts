import {
  createPublicClient,
  decodeEventLog,
  http,
  type Address,
  type Hash,
} from "viem";
import { baseSepolia } from "viem/chains";
import Bridge from "../abis/Bridge";

export async function generateProof(
  transactionHash: Hash,
  bridgeBaseBlockNumber: bigint,
  baseBridgeAddress: Address
) {
  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(),
  });

  const txReceipt = await publicClient.getTransactionReceipt({
    hash: transactionHash,
  });

  // Extract and decode MessageRegistered events
  const messageRegisteredEvents = txReceipt.logs
    .map((log) => {
      if (bridgeBaseBlockNumber < log.blockNumber) {
        throw new Error(
          `Transaction not finalized yet: ${bridgeBaseBlockNumber} < ${log.blockNumber}`
        );
      }

      try {
        const decodedLog = decodeEventLog({
          abi: Bridge,
          data: log.data,
          topics: log.topics,
        });

        return decodedLog.eventName === "MessageInitiated"
          ? {
              messageHash: decodedLog.args.messageHash,
              mmrRoot: decodedLog.args.mmrRoot,
              message: decodedLog.args.message,
            }
          : null;
      } catch (error) {
        return null;
      }
    })
    .filter((event) => event !== null);

  console.log(
    `Found ${messageRegisteredEvents.length} MessageRegistered event(s)`
  );

  if (messageRegisteredEvents.length !== 1) {
    throw new Error("Unexpected number of MessageRegistered events detected");
  }

  const event = messageRegisteredEvents[0]!;

  console.log("Message Details:");
  console.log(`  Hash: ${event.messageHash}`);
  console.log(`  MMR Root: ${event.mmrRoot}`);
  console.log(`  Nonce: ${event.message.nonce}`);
  console.log(`  Sender: ${event.message.sender}`);
  console.log(`  Data: ${event.message.data}`);

  const rawProof = await publicClient.readContract({
    address: baseBridgeAddress,
    abi: Bridge,
    functionName: "generateProof",
    args: [event.message.nonce],
    blockNumber: bridgeBaseBlockNumber,
  });

  console.log(`Proof generated at block ${bridgeBaseBlockNumber}`);
  console.log(`  Leaf index: ${event.message.nonce}`);

  return { event, rawProof };
}
