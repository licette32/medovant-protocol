import { Keypair } from '@solana/web3.js'

const STORAGE_KEY = 'medovant_tech_keypair'

/**
 * Persists a devnet technician keypair in localStorage so "Complete maintenance"
 * can sign as technician without a second wallet extension.
 */
export function loadOrCreateTechnicianKeypair(): Keypair {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored) {
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(stored) as number[]))
  }
  const kp = Keypair.generate()
  localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(kp.secretKey)))
  return kp
}
