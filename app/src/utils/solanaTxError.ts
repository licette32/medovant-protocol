import type { Program } from '@coral-xyz/anchor'
import { AnchorProvider } from '@coral-xyz/anchor'
import { SendTransactionError } from '@solana/web3.js'
import { toast } from 'sonner'

function getConnection(program: Program | null) {
  if (!program?.provider) return undefined
  return (program.provider as AnchorProvider).connection
}

/**
 * Logs simulation/tx details from {@link SendTransactionError#getLogs} and shows a toast.
 * Use after failed Anchor `.rpc()` calls.
 */
export async function toastAnchorTxError(program: Program | null, err: unknown): Promise<void> {
  const connection = getConnection(program)
  let message = err instanceof Error ? err.message : String(err)

  if (connection && err instanceof SendTransactionError) {
    try {
      const logs = await err.getLogs(connection)
      if (logs?.length) {
        console.error('[Medovant] Transaction logs:\n', logs.join('\n'))
      }
    } catch (logErr) {
      console.warn('[Medovant] getLogs() failed:', logErr)
    }
  }

  if (/insufficient lamports/i.test(message)) {
    message =
      'Insufficient SOL: the connected wallet needs SOL on Devnet to pay rent/fees. Fund it with: solana airdrop 1 <YOUR_PUBKEY> --url devnet'
  }

  toast.error(message)
}
