import { useWallet } from '@solana/wallet-adapter-react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'
import { truncatePubkey } from '@/utils/formatters'

type Props = { lastTxSig?: string }

export default function Topbar({ lastTxSig: _lastTxSig }: Props) {
  const { publicKey, connected } = useWallet()

  return (
    <header className="mb-8 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-navy">Overview</h1>
        <p className="mt-1 text-sm text-stone-600">
          Medical equipment maintenance escrow on Solana — hospital and technician flows.
        </p>
      </div>
      <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
        {connected && publicKey && (
          <span className="font-mono text-xs text-stone-500" title={publicKey.toBase58()}>
            {truncatePubkey(publicKey.toBase58())}
          </span>
        )}
        <WalletMultiButton />
      </div>
    </header>
  )
}
