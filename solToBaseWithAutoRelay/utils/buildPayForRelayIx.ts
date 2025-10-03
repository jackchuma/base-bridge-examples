import {
  createSolanaRpc,
  devnet,
  getProgramDerivedAddress,
  type Address,
  type KeyPairSigner,
} from "@solana/kit";
import {
  fetchCfg,
  getPayForRelayInstruction,
} from "../clients/ts/src/base-relayer";
import { SYSTEM_PROGRAM_ADDRESS } from "@solana-program/system";

export async function buildPayForRelayIx(
  rpcUrl: string,
  relayerProgramId: Address,
  outgoingMessage: Address,
  payer: KeyPairSigner<string>
) {
  const solRpc = createSolanaRpc(devnet(`https://${rpcUrl}`));

  const [cfgAddress] = await getProgramDerivedAddress({
    programAddress: relayerProgramId,
    seeds: [Buffer.from("config")],
  });

  const cfg = await fetchCfg(solRpc, cfgAddress);

  const { salt, pubkey: messageToRelay } = await mtrPubkey(relayerProgramId);
  console.log(`Message To Relay: ${messageToRelay}`);

  return getPayForRelayInstruction(
    {
      // Accounts
      payer,
      cfg: cfgAddress,
      gasFeeReceiver: cfg.data.gasConfig.gasFeeReceiver,
      messageToRelay,
      mtrSalt: salt,
      systemProgram: SYSTEM_PROGRAM_ADDRESS,

      // Arguments
      outgoingMessage: outgoingMessage,
      gasLimit: 200_000n,
    },
    { programAddress: relayerProgramId }
  );
}

async function mtrPubkey(baseRelayerProgram: Address, salt?: Uint8Array) {
  const bytes = new Uint8Array(32);
  const s = salt ?? crypto.getRandomValues(bytes);

  const [pubkey] = await getProgramDerivedAddress({
    programAddress: baseRelayerProgram,
    seeds: [Buffer.from("mtr"), Buffer.from(s)],
  });

  return { salt: s, pubkey };
}
