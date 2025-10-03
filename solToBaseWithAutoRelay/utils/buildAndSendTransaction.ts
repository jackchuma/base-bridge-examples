import {
  addSignersToTransactionMessage,
  appendTransactionMessageInstructions,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
  createTransactionMessage,
  devnet,
  getSignatureFromTransaction,
  pipe,
  sendAndConfirmTransactionFactory,
  setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  type Instruction,
  type TransactionSigner,
} from "@solana/kit";

export async function buildAndSendTransaction(
  rpcUrl: string,
  ixs: Instruction[],
  payer: TransactionSigner
) {
  const solRpc = createSolanaRpc(`https://${rpcUrl}`);
  const rpcSubscriptions = createSolanaRpcSubscriptions(
    devnet(`wss://${rpcUrl}`)
  );

  const sendAndConfirmTx = sendAndConfirmTransactionFactory({
    rpc: solRpc,
    rpcSubscriptions,
  });

  const blockhash = await solRpc.getLatestBlockhash().send();

  const transactionMessage = pipe(
    createTransactionMessage({ version: 0 }),
    (tx) => setTransactionMessageFeePayer(payer.address, tx),
    (tx) => setTransactionMessageLifetimeUsingBlockhash(blockhash.value, tx),
    (tx) => appendTransactionMessageInstructions(ixs, tx),
    (tx) => addSignersToTransactionMessage([payer], tx)
  );

  const signedTransaction = await signTransactionMessageWithSigners(
    transactionMessage
  );

  const signature = getSignatureFromTransaction(signedTransaction);

  await sendAndConfirmTx(signedTransaction, {
    commitment: "confirmed",
  });

  return signature;
}
