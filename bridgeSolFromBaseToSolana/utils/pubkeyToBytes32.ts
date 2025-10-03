import { getBase58Codec, type Address } from "@solana/kit";
import { type Address as EVMAddress } from "viem";

export function pubkeyToBytes32(inp: Address): EVMAddress {
  const b32 = getBase58Codec().encode(inp).toHex();
  return `0x${b32}`;
}
