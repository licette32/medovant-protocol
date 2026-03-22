import BN from 'bn.js'
import { PublicKey } from '@solana/web3.js'

const PROGRAM_ID = new PublicKey('5JMd8ADy1KHBhohX6NLbz6WQdyCQTfLd55Gmzo2r34WD')

export function getMedicalAssetPDA(hospital: PublicKey, assetId: number) {
  const [pda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from('equipment'),
      hospital.toBuffer(),
      new BN(assetId).toArrayLike(Buffer, 'le', 8),
    ],
    PROGRAM_ID
  )
  return pda
}

export function getEscrowVaultPDA(medicalAssetPDA: PublicKey) {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('vault'), medicalAssetPDA.toBuffer()],
    PROGRAM_ID
  )
  return pda
}

export function getTechnicianProfilePDA(technician: PublicKey) {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('technician'), technician.toBuffer()],
    PROGRAM_ID
  )
  return pda
}
