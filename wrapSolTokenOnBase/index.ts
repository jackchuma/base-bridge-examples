import {
  checksumAddress,
  createPublicClient,
  createWalletClient,
  http,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import TokenFactory from "./abis/TokenFactory";
import { getBase58Codec } from "@solana/kit";

// Params to configure
const SOLANA_SPL_MINT_ADDRESS = "8KkQRERXdASmXqeWw7sPFB56wLxyHMKc9NPDW64EEL31";
const TOKEN_NAME = "My Token";
const TOKEN_SYMBOL = "MT";
const DECIMALS = 9;

// Constants
const BRIDGE_TOKEN_FACTORY = "0x58207331CBF8Af87BB6453b610E6579D9878e4EA";
const CROSS_CHAIN_ERC20_CREATED_TOPIC =
  "0x0b84965add45c4d10c5aacc22714edc5f88def8df83d2c1f9d18b45ef2d28783";

async function main() {
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

  const mintBytes32 = getBase58Codec().encode(SOLANA_SPL_MINT_ADDRESS).toHex();

  console.log("Sending transaction");
  const hash = await client.writeContract({
    address: BRIDGE_TOKEN_FACTORY,
    abi: TokenFactory,
    functionName: "deploy",
    args: [`0x${mintBytes32}`, TOKEN_NAME, TOKEN_SYMBOL, DECIMALS],
  });
  const receipt = await pubClient.waitForTransactionReceipt({ hash });
  console.log("Transaction successful!");

  const { logs } = receipt;

  if (!logs) {
    throw new Error("Logs not found in transaction receipt");
  }

  for (let i = 0; i < logs.length; i++) {
    const log = logs[i];

    if (
      log?.address?.toLowerCase() === BRIDGE_TOKEN_FACTORY.toLowerCase() &&
      log?.topics[0]?.toLowerCase() ===
        CROSS_CHAIN_ERC20_CREATED_TOPIC.toLowerCase()
    ) {
      const newTokenAddress = log.topics[1];
      console.log(
        `${TOKEN_NAME} deployed to ${checksumAddress(
          ("0x" + newTokenAddress?.slice(26)) as Address
        )}`
      );
      return;
    }
  }
  console.error("Unable to find new wrapped token address");
}

main().catch(console.error);
