import { toast } from 'sonner'
import { truncateSig } from '@/utils/formatters'

/** Standard success toast with one-click jump to Solana Explorer (devnet). */
export function showTxToast(sig: string) {
  const url = `https://explorer.solana.com/tx/${sig}?cluster=devnet`
  toast.success('Transaction confirmed', {
    description: truncateSig(sig),
    action: {
      label: 'View on Explorer',
      onClick: () => window.open(url, '_blank'),
    },
    duration: 5000,
  })
}
