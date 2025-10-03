import {
  createPublicClient,
  createWalletClient,
  http,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { address } from "@solana/kit";
import Bridge from "./abis/Bridge";
import { pubkeyToBytes32 } from "./utils/pubkeyToBytes32";

// Params to configure
const LOCAL_TOKEN = "0xC5b9112382f3c87AFE8e1A28fa52452aF81085AD" as Address;
const TO = address("BEwzVVw44VLaspWByUML23hbQmo5ndM1NPQAJsvCxC6F"); // Your Solana pubkey
const AMOUNT = 0.001;

// Constants
const BASE_BRIDGE_ADDRESS = "0xB2068ECCDb908902C76E3f965c1712a9cF64171E";
const SOL_ADDRESS = address("SoL1111111111111111111111111111111111111111");

async function main() {
  // NOTE: Comment / uncomment based on what step you're on
  // STEP 1: Initiate message on Base
  await initiateMessageOnBase();
  // Take note of the transaction hash
}

async function initiateMessageOnBase() {
  // NOTE: Expects a local private key in a `.env` file named `PK`
  const account = privateKeyToAccount(process.env.PK as Hex);
  const pubClient = createPublicClient({
    chain: baseSepolia,
    transport: http(),
  });
  const client = createWalletClient({
    account,
    chain: baseSepolia,
    transport: http(),
  });

  // Calculate scaled amount (amount * 10^decimals)
  const scaledAmount = BigInt(Math.floor(AMOUNT * Math.pow(10, 9)));
  console.log(`Amount: ${AMOUNT}`);
  console.log(`Scaled amount: ${scaledAmount}`);

  // Build input args
  const transfer = {
    localToken: LOCAL_TOKEN,
    remoteToken: pubkeyToBytes32(SOL_ADDRESS),
    to: pubkeyToBytes32(TO),
    remoteAmount: scaledAmount,
  };
  const ixs: { programId: Hex; serializedAccounts: Hex[]; data: Hex }[] = [];

  console.log("Sending transaction");
  const hash = await client.writeContract({
    address: BASE_BRIDGE_ADDRESS,
    abi: Bridge,
    functionName: "bridgeToken",
    args: [transfer, ixs],
  });
  await pubClient.waitForTransactionReceipt({ hash });
  console.log("Transaction successful! Hash:", hash);
}

main().catch(console.error);
