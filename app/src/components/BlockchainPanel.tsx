import { ExternalLink } from 'lucide-react'
import { truncateSig } from '@/utils/formatters'

const PROGRAM_ID = '5JMd8ADy1KHBhohX6NLbz6WQdyCQTfLd55Gmzo2r34WD'

type Props = { lastTxSig?: string }

export default function BlockchainPanel({ lastTxSig }: Props) {
  const explorerTx = lastTxSig
    ? `https://explorer.solana.com/tx/${lastTxSig}?cluster=devnet`
    : null
  const explorerProg = `https://explorer.solana.com/address/${PROGRAM_ID}?cluster=devnet`

  return (
    <section className="mt-8 rounded-xl border border-stone-200 bg-surface2/80 p-5">
      <h3 className="text-sm font-semibold text-navy">Blockchain</h3>
      <dl className="mt-3 space-y-2 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-stone-500">Program ID</dt>
          <dd className="font-mono text-xs text-navy break-all">{PROGRAM_ID}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-stone-500">Network</dt>
          <dd className="font-medium text-navy">Solana Devnet</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-stone-500">Last Transaction</dt>
          <dd>
            {lastTxSig ? (
              <a
                href={explorerTx!}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-mono text-xs text-lavender hover:underline"
              >
                {truncateSig(lastTxSig)}
                <ExternalLink className="h-3 w-3" />
              </a>
            ) : (
              <span className="text-stone-400">—</span>
            )}
          </dd>
        </div>
      </dl>
      <a
        href={explorerProg}
        target="_blank"
        rel="noreferrer"
        className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-lavender hover:underline"
      >
        View program on Explorer
        <ExternalLink className="h-3 w-3" />
      </a>
    </section>
  )
}
