import { encodeAbiParameters, keccak256, padHex, toHex, type Hex } from "viem";
import type { fetchOutgoingMessage } from "../clients/ts/src/bridge";
import {
  getBase58Codec,
  getBase58Encoder,
  type Address as SolAddress,
} from "@solana/kit";

// See MessageType enum in MessageLib.sol
const MessageType = {
  Call: 0,
  Transfer: 1,
  TransferAndCall: 2,
} as const;

export function buildEvmMessage(
  outgoing: Awaited<ReturnType<typeof fetchOutgoingMessage>>
) {
  const nonce = BigInt(outgoing.data.nonce);
  const senderBytes32 = bytes32FromPubkey(outgoing.data.sender);
  const { ty, data } = buildIncomingPayload(outgoing);

  const innerHash = keccak256(
    encodeAbiParameters(
      [{ type: "bytes32" }, { type: "uint8" }, { type: "bytes" }],
      [senderBytes32, ty, data]
    )
  );

  const pubkey = getBase58Codec().encode(outgoing.address);

  const outerHash = keccak256(
    encodeAbiParameters(
      [{ type: "uint64" }, { type: "bytes32" }, { type: "bytes32" }],
      [nonce, `0x${pubkey.toHex()}`, innerHash]
    )
  );

  const evmMessage = {
    outgoingMessagePubkey: bytes32FromPubkey(outgoing.address),
    gasLimit: 100_000n,
    nonce,
    sender: senderBytes32,
    ty,
    data,
  };

  return { innerHash, outerHash, evmMessage };
}

function bytes32FromPubkey(pubkey: SolAddress): Hex {
  const bytes = getBase58Encoder().encode(pubkey);

  // toHex requires a mutable Uint8Array
  let hex = toHex(new Uint8Array(bytes));
  if (hex.length !== 66) {
    // left pad to 32 bytes if needed
    hex = padHex(hex, { size: 32 });
  }

  return hex;
}

function buildIncomingPayload(
  outgoing: Awaited<ReturnType<typeof fetchOutgoingMessage>>
) {
  const msg = outgoing.data.message;

  if (msg.__kind !== "Transfer") {
    throw new Error("Unexpected message type");
  }

  // Transfer (with optional call)
  const transfer = msg.fields[0];

  const transferTuple = {
    localToken: `0x${toHex(new Uint8Array(transfer.remoteToken)).slice(2)}`,
    remoteToken: bytes32FromPubkey(transfer.localToken),
    to: padHex(`0x${toHex(new Uint8Array(transfer.to)).slice(2)}`, {
      size: 32,
      // Bytes32 `to` expects the EVM address in the first 20 bytes.
      // Right-pad zeros so casting `bytes20(to)` yields the intended address.
      dir: "right",
    }),
    remoteAmount: BigInt(transfer.amount),
  } as const;

  const encodedTransfer = encodeAbiParameters(
    [
      {
        type: "tuple",
        components: [
          { name: "localToken", type: "address" },
          { name: "remoteToken", type: "bytes32" },
          { name: "to", type: "bytes32" },
          { name: "remoteAmount", type: "uint64" },
        ],
      },
    ],
    [transferTuple]
  );

  if (transfer.call.__option !== "None") {
    throw new Error("Transfer with call not supported");
  }

  return { ty: MessageType.Transfer, data: encodedTransfer, transferTuple };
}
