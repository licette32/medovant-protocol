/**
 * Cliente para probar Medovant - wallet, balance y initialize_asset
 */

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import * as path from "path";
import * as fs from "fs";

// tipo de la cuenta MedicalAsset (según IDL)
interface MedicalAssetAccount {
  hospital: PublicKey;
  assetId: anchor.BN;
  status: { active?: object } | { issueReported?: object } | { underMaintenance?: object } | { decommissioned?: object };
  lastMaintenance: anchor.BN;
  bump: number;
}

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const wallet = provider.wallet;
  const connection = provider.connection;

  const balance = await connection.getBalance(wallet.publicKey);
  const solBalance = balance / LAMPORTS_PER_SOL;
  console.log("wallet:", wallet.publicKey.toBase58(), "| balance:", solBalance.toFixed(4), "SOL");

  const idlPath = path.join(__dirname, "..", "target", "idl", "medovant.json");
  if (!fs.existsSync(idlPath)) {
    console.warn("falta IDL - corre anchor build primero");
    return;
  }

  const idl = JSON.parse(fs.readFileSync(idlPath, "utf8"));
  const program = new Program(idl, provider) as anchor.Program;

  const assetId = new anchor.BN(1);
  const [medicalAssetPda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from("equipment"),
      wallet.publicKey.toBuffer(),
      assetId.toArrayLike(Buffer, "le", 8),
    ],
    program.programId
  );

  try {
    const tx = await program.methods
      .initializeAsset(assetId)
      .accounts({
        hospital: wallet.publicKey,
        medicalAsset: medicalAssetPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    const account = (await (program.account as Record<string, { fetch: (p: PublicKey) => Promise<unknown> }>).medicalAsset.fetch(medicalAssetPda)) as MedicalAssetAccount;
    const status =
      "active" in account.status && account.status.active !== undefined
        ? "Active"
        : "IssueReported/UnderMaintenance/Decommissioned";
    console.log("ok - cuenta creada, status:", status);
  } catch (e: unknown) {
    const msg = e && typeof e === "object" && "message" in e ? String((e as { message: string }).message) : String(e);
    if (msg.includes("already in use") || msg.includes("0x0")) {
      const account = (await (program.account as Record<string, { fetch: (p: PublicKey) => Promise<unknown> }>).medicalAsset.fetch(medicalAssetPda)) as MedicalAssetAccount;
      const status =
        "active" in account.status && account.status.active !== undefined ? "Active" : "Otro";
      console.log("ya existia asset 1, status:", status);
    } else {
      throw e;
    }
  }
}

main().catch(console.error);
