import {
  createPublicClient,
  createWalletClient,
  http,
  toBytes,
  toHex,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import {
  address,
  createSolanaRpc,
  devnet,
  Endian,
  getProgramDerivedAddress,
  getU64Encoder,
  type Instruction,
} from "@solana/kit";
import Bridge from "./abis/Bridge";
import { pubkeyToBytes32 } from "./utils/pubkeyToBytes32";
import {
  fetchBridge,
  fetchIncomingMessage,
  getProveMessageInstruction,
  getRelayMessageInstruction,
} from "./clients/ts/src/bridge";
import { getSolanaCliConfigKeypairSigner } from "./utils/keypair";
import { SYSTEM_PROGRAM_ADDRESS } from "@solana-program/system";
import { buildAndSendTransaction } from "./utils/buildAndSendTransaction";
import { generateProof } from "./utils/generateProof";
import { messageTransferAccounts } from "./utils/messageTransferAccounts";

// Params to configure
const LOCAL_TOKEN = "0xC5b9112382f3c87AFE8e1A28fa52452aF81085AD" as Address;
const TO = address("BEwzVVw44VLaspWByUML23hbQmo5ndM1NPQAJsvCxC6F"); // Your Solana pubkey
const AMOUNT = 0.001;

// Constants
const BASE_BRIDGE_ADDRESS = "0xB2068ECCDb908902C76E3f965c1712a9cF64171E";
const SOL_ADDRESS = address("SoL1111111111111111111111111111111111111111");
const BRIDGE_PROGRAM_ID = address(
  "HSvNvzehozUpYhRBuCKq3Fq8udpRocTmGMUYXmCSiCCc"
);
const SOLANA_RPC_URL = "api.devnet.solana.com";

async function main() {
  // NOTE: Comment / uncomment based on what step you're on

  // STEP 1: Initiate message on Base
  const txHash = await initiateMessageOnBase();
  console.log(`Tx hash: ${txHash}`);

  // STEP 2: Check if transaction is provable yet (cannot proceed until this is true)
  // const txHash = "0x";
  // const isProvable = await isBridgeMessageProvable(txHash);
  // console.log(`Is provable: ${isProvable}`);

  // STEP 3: Prove message on Solana
  // const messageHash = await proveMessage(txHash);
  // console.log(`Message Hash: ${messageHash}`);

  // STEP 4: Execute message on Solana
  // const messageHash = "0x";
  // await executeMessage(messageHash);
}

async function initiateMessageOnBase(): Promise<Hex> {
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
  return hash;
}

async function isBridgeMessageProvable(txHash: Hex): Promise<boolean> {
  const rpc = createSolanaRpc(devnet(`https://${SOLANA_RPC_URL}`));
  const payer = await getSolanaCliConfigKeypairSigner();
  console.log(`Payer: ${payer.address}`);

  // Derive and query bridge account address storing global config
  const [bridgeAccountAddress] = await getProgramDerivedAddress({
    programAddress: BRIDGE_PROGRAM_ID,
    seeds: [Buffer.from("bridge")],
  });
  console.log(`Bridge account: ${bridgeAccountAddress}`);

  const bridge = await fetchBridge(rpc, bridgeAccountAddress);
  const baseBlockNumber = bridge.data.baseBlockNumber;
  console.log(`Base Block Number: ${baseBlockNumber}`);

  const publicClient = createPublicClient({
    chain: baseSepolia,
    transport: http(),
  });

  const txReceipt = await publicClient.getTransactionReceipt({ hash: txHash });

  return baseBlockNumber >= txReceipt.blockNumber;
}

async function proveMessage(txHash: Hex): Promise<Hex> {
  const rpcUrl = devnet(`https://${SOLANA_RPC_URL}`);
  const rpc = createSolanaRpc(rpcUrl);
  console.log(`RPC URL: ${rpcUrl}`);

  const payer = await getSolanaCliConfigKeypairSigner();
  console.log(`Payer: ${payer.address}`);

  const [bridgeAddress] = await getProgramDerivedAddress({
    programAddress: BRIDGE_PROGRAM_ID,
    seeds: [Buffer.from("bridge")],
  });
  console.log(`Bridge: ${bridgeAddress}`);

  const bridge = await fetchBridge(rpc, bridgeAddress);
  const baseBlockNumber = bridge.data.baseBlockNumber;
  console.log(`Base Block Number: ${baseBlockNumber}`);

  const [outputRootAddress] = await getProgramDerivedAddress({
    programAddress: BRIDGE_PROGRAM_ID,
    seeds: [
      Buffer.from("output_root"),
      getU64Encoder({ endian: Endian.Little }).encode(baseBlockNumber),
    ],
  });
  console.log(`Output Root: ${outputRootAddress}`);

  const { event, rawProof } = await generateProof(
    txHash,
    baseBlockNumber,
    BASE_BRIDGE_ADDRESS
  );

  const [messageAddress] = await getProgramDerivedAddress({
    programAddress: BRIDGE_PROGRAM_ID,
    seeds: [Buffer.from("incoming_message"), toBytes(event.messageHash)],
  });
  console.log(`Message: ${messageAddress}`);
  console.log(`Nonce: ${event.message.nonce}`);
  console.log(`Sender: ${event.message.sender}`);
  console.log(`Message Hash: ${event.messageHash}`);

  // Build prove message instruction
  console.log("Building instruction...");
  const ix = getProveMessageInstruction(
    {
      // Accounts
      payer,
      outputRoot: outputRootAddress,
      message: messageAddress,
      bridge: bridgeAddress,
      systemProgram: SYSTEM_PROGRAM_ADDRESS,

      // Arguments
      nonce: event.message.nonce,
      sender: toBytes(event.message.sender),
      data: toBytes(event.message.data),
      proof: rawProof.map((e: string) => toBytes(e)),
      messageHash: toBytes(event.messageHash),
    },
    { programAddress: BRIDGE_PROGRAM_ID }
  );

  console.log("Sending transaction...");
  const signature = await buildAndSendTransaction(SOLANA_RPC_URL, [ix], payer);
  console.log("Message proof completed");
  console.log(
    `Transaction: https://explorer.solana.com/tx/${signature}?cluster=devnet`
  );

  return event.messageHash;
}

async function executeMessage(msgHash: Hex) {
  const rpcUrl = devnet(`https://${SOLANA_RPC_URL}`);
  const rpc = createSolanaRpc(rpcUrl);
  console.log(`RPC URL: ${rpcUrl}`);

  const payer = await getSolanaCliConfigKeypairSigner();
  console.log(`Payer: ${payer.address}`);

  const [messagePda] = await getProgramDerivedAddress({
    programAddress: BRIDGE_PROGRAM_ID,
    seeds: [Buffer.from("incoming_message"), toBytes(msgHash)],
  });
  console.log(`Message PDA: ${messagePda}`);

  // Fetch the message to get the sender for the bridge CPI authority
  const incomingMessage = await fetchIncomingMessage(rpc, messagePda);
  console.log(
    `Message sender: ${toHex(Buffer.from(incomingMessage.data.sender))}`
  );

  if (incomingMessage.data.executed) {
    console.log("Message has already been executed");
    return;
  }

  const message = incomingMessage.data.message;

  if (message.__kind === "Call") {
    throw new Error("Call type not supported");
  }

  const remainingAccounts = await messageTransferAccounts(
    message,
    BRIDGE_PROGRAM_ID
  );

  const [bridgeAccountAddress] = await getProgramDerivedAddress({
    programAddress: BRIDGE_PROGRAM_ID,
    seeds: [Buffer.from("bridge")],
  });
  console.log(`Bridge account address: ${bridgeAccountAddress}`);

  const relayMessageIx = getRelayMessageInstruction(
    { message: messagePda, bridge: bridgeAccountAddress },
    { programAddress: BRIDGE_PROGRAM_ID }
  );

  const relayMessageIxWithRemainingAccounts: Instruction = {
    programAddress: relayMessageIx.programAddress,
    accounts: [...relayMessageIx.accounts, ...remainingAccounts],
    data: relayMessageIx.data,
  };

  console.log("Sending transaction...");
  const signature = await buildAndSendTransaction(
    SOLANA_RPC_URL,
    [relayMessageIxWithRemainingAccounts],
    payer
  );
  console.log(
    `Transaction: https://explorer.solana.com/tx/${signature}?cluster=devnet`
  );
}

main().catch(console.error);
