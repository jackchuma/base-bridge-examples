import {
  address,
  createSolanaRpc,
  devnet,
  getProgramDerivedAddress,
  type Instruction,
} from "@solana/kit";
import { fetchBridge, getBridgeSolInstruction } from "./clients/ts/src/bridge";
import { toBytes } from "viem";
import { buildAndSendTransaction } from "./utils/buildAndSendTransaction";
import { monitorMessageExecution } from "./utils/monitorMessageExecution";
import { genOutgoingMessage } from "./utils/genOutgoingMessage";
import { buildPayForRelayIx } from "./utils/buildPayForRelayIx";
import { getSolanaCliConfigKeypairSigner } from "./utils/keypair";
import { SYSTEM_PROGRAM_ADDRESS } from "@solana-program/system";

// Configure recipient and amount
const TO = "0x8c1a617bdb47342f9c17ac8750e0b070c372c721"; // your Base address
const AMOUNT = 0.001;

// Constants
const REMOTE_TOKEN = "0xC5b9112382f3c87AFE8e1A28fa52452aF81085AD"; // wSOL address on Base Sepolia
const BRIDGE_CONTRACT = "0xB2068ECCDb908902C76E3f965c1712a9cF64171E";
const BRIDGE_PROGRAM_ID = address(
  "HSvNvzehozUpYhRBuCKq3Fq8udpRocTmGMUYXmCSiCCc"
);
const RELAYER_PROGRAM_ID = address(
  "ExS1gcALmaA983oiVpvFSVohi1zCtAUTgsLj5xiFPPgL"
);
const SOLANA_RPC_URL = "api.devnet.solana.com";

async function main() {
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

  // Generates the account pubkey that will store this outgoing message
  // This account is what the oracle will pick up on
  const { salt, pubkey: outgoingMessage } = await genOutgoingMessage(
    BRIDGE_PROGRAM_ID
  );
  console.log(`Outgoing message: ${outgoingMessage}`);

  // Derive the vault address that will lock the user's SOL
  const remoteToken = toBytes(REMOTE_TOKEN);
  const [solVaultAddress] = await getProgramDerivedAddress({
    programAddress: BRIDGE_PROGRAM_ID,
    seeds: [Buffer.from("sol_vault"), Buffer.from(remoteToken)],
  });
  console.log(`Sol Vault: ${solVaultAddress}`);

  // Calculate scaled amount (amount * 10^decimals)
  const scaledAmount = BigInt(Math.floor(AMOUNT * Math.pow(10, 9)));
  console.log(`Amount: ${AMOUNT}`);
  console.log(`Scaled amount: ${scaledAmount}`);

  const ixs: Instruction[] = [
    getBridgeSolInstruction(
      {
        // Accounts
        payer,
        from: payer,
        gasFeeReceiver: bridge.data.gasConfig.gasFeeReceiver,
        solVault: solVaultAddress,
        bridge: bridgeAccountAddress,
        outgoingMessage,
        systemProgram: SYSTEM_PROGRAM_ADDRESS,

        // Arguments
        outgoingMessageSalt: salt,
        to: toBytes(TO),
        remoteToken,
        amount: scaledAmount,
        call: null,
      },
      { programAddress: BRIDGE_PROGRAM_ID }
    ),
    await buildPayForRelayIx(
      SOLANA_RPC_URL,
      RELAYER_PROGRAM_ID,
      outgoingMessage,
      payer
    ),
  ];

  const signature = await buildAndSendTransaction(SOLANA_RPC_URL, ixs, payer);

  console.log("Bridge SOL operation completed!");
  console.log(
    `Transaction: https://explorer.solana.com/tx/${signature}?cluster=devnet`
  );

  // Wait for message to be executed on Base
  await monitorMessageExecution(
    SOLANA_RPC_URL,
    BRIDGE_CONTRACT,
    outgoingMessage
  );
}

main().catch(console.error);
