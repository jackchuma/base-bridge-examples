import {
  AccountRole,
  getProgramDerivedAddress,
  type AccountMeta,
  type Address,
} from "@solana/kit";
import type {
  BridgeBaseToSolanaStateIncomingMessageMessage,
  BridgeBaseToSolanaStateIncomingMessageTransfer,
  Ix,
} from "../clients/ts/src/bridge";
import { SYSTEM_PROGRAM_ADDRESS } from "@solana-program/system";

type MessageTransfer = Extract<
  BridgeBaseToSolanaStateIncomingMessageMessage,
  { __kind: "Transfer" }
>;
export async function messageTransferAccounts(
  message: MessageTransfer,
  solanaBridge: Address
) {
  console.log(`Transfer message with ${message.ixs.length} instructions`);

  if (message.transfer.__kind !== "Sol") {
    throw new Error("Only SOL transfers supported");
  }

  const remainingAccounts: Array<AccountMeta> =
    await messageTransferSolAccounts(message.transfer, solanaBridge);

  // Process the list of optional instructions
  const ixs = message.ixs;

  // Include both the accounts and program IDs for each instruction
  remainingAccounts.push(
    ...(await getIxAccounts(ixs)),
    ...ixs.map((i) => ({
      address: i.programId,
      role: AccountRole.READONLY,
    }))
  );

  return remainingAccounts;
}

type MessageTransferSol = Extract<
  BridgeBaseToSolanaStateIncomingMessageTransfer,
  { __kind: "Sol" }
>;
async function messageTransferSolAccounts(
  message: MessageTransferSol,
  solanaBridge: Address
) {
  console.log("SOL transfer detected");

  const { remoteToken, to, amount } = message.fields[0];

  console.log(`SOL transfer:`);
  console.log(`  Remote token: 0x${remoteToken.toHex()}`);
  console.log(`  To: ${to}`);
  console.log(`  Amount: ${amount}`);

  const [solVaultPda] = await getProgramDerivedAddress({
    programAddress: solanaBridge,
    seeds: [Buffer.from("sol_vault"), Buffer.from(remoteToken)],
  });
  console.log(`SOL vault PDA: ${solVaultPda}`);

  return [
    { address: solVaultPda, role: AccountRole.WRITABLE },
    { address: to, role: AccountRole.WRITABLE },
    { address: SYSTEM_PROGRAM_ADDRESS, role: AccountRole.READONLY },
  ];
}

async function getIxAccounts(ixs: Ix[]) {
  const allIxsAccounts = [];

  for (const ix of ixs) {
    const ixAccounts = await Promise.all(
      ix.accounts.map(async (acc) => {
        return {
          address: acc.pubkey,
          role: acc.isWritable
            ? acc.isSigner
              ? AccountRole.WRITABLE_SIGNER
              : AccountRole.WRITABLE
            : acc.isSigner
            ? AccountRole.READONLY_SIGNER
            : AccountRole.READONLY,
        };
      })
    );

    allIxsAccounts.push(...ixAccounts);
  }

  return allIxsAccounts;
}
