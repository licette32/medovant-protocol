import type { ReactNode } from 'react'
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react'
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui'
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets'
import { clusterApiUrl } from '@solana/web3.js'
import '@solana/wallet-adapter-react-ui/styles.css'

/** Devnet RPC — same cluster the Medovant program is deployed for in this dashboard. */
const DEFAULT_DEVNET_RPC = clusterApiUrl('devnet')

const endpoint = import.meta.env.VITE_RPC_URL ?? DEFAULT_DEVNET_RPC
const wallets = [new PhantomWalletAdapter(), new SolflareWalletAdapter()]

export function SolanaWalletProvider({ children }: { children: ReactNode }) {
  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  )
}
