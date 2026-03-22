import { toast } from 'sonner'
import { normalizeTxSignature, truncateSig } from '@/utils/formatters'

/** Standard success toast with one-click jump to Solana Explorer (devnet). */
export function showTxToast(sig: unknown) {
  const clean = normalizeTxSignature(sig)
  if (!clean) {
    toast.success('Transaction confirmed', { duration: 5000 })
    return
  }
  const url = `https://explorer.solana.com/tx/${encodeURIComponent(clean)}?cluster=devnet`
  toast.success('Transaction confirmed', {
    description: truncateSig(clean),
    action: {
      label: 'View on Explorer',
      onClick: () => {
        try {
          const w = window.open(url, '_blank', 'noopener,noreferrer')
          if (w == null) toast.message('Open Explorer', { description: url })
        } catch {
          toast.message('Explorer', { description: url })
        }
      },
    },
    duration: 5000,
  })
}
