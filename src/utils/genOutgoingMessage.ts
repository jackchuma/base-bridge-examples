import { getProgramDerivedAddress, type Address } from "@solana/kit";

export async function genOutgoingMessage(
  bridgeProgram: Address,
  salt?: Uint8Array
) {
  const bytes = new Uint8Array(32);
  const s = salt ?? crypto.getRandomValues(bytes);

  const [pubkey] = await getProgramDerivedAddress({
    programAddress: bridgeProgram,
    seeds: [Buffer.from("outgoing_message"), Buffer.from(s)],
  });

  return { salt: s, pubkey };
}
