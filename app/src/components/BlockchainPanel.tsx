import { ExternalLink } from 'lucide-react'
import { useLang } from '@/i18n/LangContext'
import { normalizeTxSignature, truncateSig } from '@/utils/formatters'

const PROGRAM_ID = '5JMd8ADy1KHBhohX6NLbz6WQdyCQTfLd55Gmzo2r34WD'

type Props = { lastTxSig?: string }

export default function BlockchainPanel({ lastTxSig }: Props) {
  const { t } = useLang()
  const safeSig = normalizeTxSignature(lastTxSig)
  const explorerTx = safeSig
    ? `https://explorer.solana.com/tx/${encodeURIComponent(safeSig)}?cluster=devnet`
    : null
  const explorerProg = `https://explorer.solana.com/address/${PROGRAM_ID}?cluster=devnet`

  return (
    <section className="mt-8 rounded-[var(--radius)] border border-med bg-surface p-5 shadow-med">
      <h3 className="text-sm font-semibold text-tpri">{t('onChainInfo')}</h3>
      <dl className="mt-4 divide-y divide-med">
        <div className="flex justify-between gap-4 py-3 first:pt-0">
          <dt className="text-[11px] font-medium uppercase tracking-wide text-tsec">{t('programId')}</dt>
          <dd className="max-w-[60%] text-right font-mono text-xs text-tpri break-all">{PROGRAM_ID}</dd>
        </div>
        <div className="flex justify-between gap-4 py-3">
          <dt className="text-[11px] font-medium uppercase tracking-wide text-tsec">{t('network')}</dt>
          <dd className="font-mono text-xs text-tpri">Solana Devnet</dd>
        </div>
        <div className="flex justify-between gap-4 py-3">
          <dt className="text-[11px] font-medium uppercase tracking-wide text-tsec">{t('lastTransaction')}</dt>
          <dd>
            {safeSig ? (
              <a
                href={explorerTx!}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-mono text-xs text-accentg hover:underline"
              >
                {truncateSig(safeSig)}
                <ExternalLink className="h-3 w-3" />
              </a>
            ) : (
              <span className="text-tmuted">—</span>
            )}
          </dd>
        </div>
      </dl>
      <div className="mt-2 border-t border-med pt-4">
        <a
          href={explorerProg}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs font-medium text-accentg no-underline hover:underline"
        >
          {t('explorer')}
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </section>
  )
}
