/**
 * Tests Medovant - flujo completo: init, report_issue, complete_maintenance, decommission
 */

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Medovant } from "../target/types/medovant";
import { PublicKey, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { expect } from "chai";

describe("medovant", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Medovant as Program<Medovant>;

  const hospital = Keypair.generate();
  const technician = Keypair.generate();
  const assetId = new anchor.BN(1);

  let medicalAssetPda: PublicKey;
  let medicalAssetBump: number;

  before(async () => {
    const sig = await provider.connection.requestAirdrop(
      hospital.publicKey,
      LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(sig);

    const sigTech = await provider.connection.requestAirdrop(
      technician.publicKey,
      LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(sigTech);

    [medicalAssetPda, medicalAssetBump] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("equipment"),
        hospital.publicKey.toBuffer(),
        assetId.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );
  });

  it("initialize_asset: crea la cuenta PDA con status Active", async () => {
    const tx = await program.methods
      .initializeAsset(assetId)
      .accounts({
        hospital: hospital.publicKey,
        medicalAsset: medicalAssetPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([hospital])
      .rpc();

    const account = await program.account.medicalAsset.fetch(medicalAssetPda);
    expect(account.hospital.equals(hospital.publicKey)).to.be.true;
    expect(account.assetId.eq(assetId)).to.be.true;
    // Anchor deserializa el enum como { active: {} }; evita cortocircuito que devolvería undefined
    expect(account.status).to.exist;
    expect(account.status).to.include.keys("active");
    expect(account.lastMaintenance.toNumber()).to.be.greaterThan(0);
    expect(account.bump).to.equal(medicalAssetBump);

    // Nota: getTransaction puede devolver null en localnet; la lógica se verifica con account.status
  });

  it("report_issue: solo si status es Active, pasa a IssueReported", async () => {
    const tx = await program.methods
      .reportIssue()
      .accounts({
        hospital: hospital.publicKey,
        medicalAsset: medicalAssetPda,
      })
      .signers([hospital])
      .rpc();

    const account = await program.account.medicalAsset.fetch(medicalAssetPda);
    expect(account.status).to.exist;
    expect(account.status).to.include.keys("issueReported");

    // Nota: getTransaction puede devolver null en localnet
  });

  it("report_issue falla si status no es Active (ya IssueReported)", async () => {
    try {
      await program.methods
        .reportIssue()
        .accounts({
          hospital: hospital.publicKey,
          medicalAsset: medicalAssetPda,
        })
        .signers([hospital])
        .rpc();
      expect.fail("Debería haber lanzado AssetNotActive");
    } catch (e: unknown) {
      const msg = e && typeof e === "object" && "message" in e ? String((e as { message: string }).message) : "";
      expect(msg).to.satisfy((m: string) => m.includes("AssetNotActive") || m.includes("6001") || m.includes("0x1771"));
    }
  });

  it("complete_maintenance: solo si IssueReported → Active, actualiza last_maintenance y paga al técnico", async () => {
    const hospitalBalanceBefore = await provider.connection.getBalance(
      hospital.publicKey
    );
    const techBalanceBefore = await provider.connection.getBalance(
      technician.publicKey
    );

    const tx = await program.methods
      .completeMaintenance()
      .accounts({
        hospital: hospital.publicKey,
        technician: technician.publicKey,
        medicalAsset: medicalAssetPda,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([hospital, technician])
      .rpc();

    const account = await program.account.medicalAsset.fetch(medicalAssetPda);
    expect(account.status).to.exist;
    expect(account.status).to.include.keys("active");
    expect(account.lastMaintenance.toNumber()).to.be.greaterThan(0);

    const techBalanceAfter = await provider.connection.getBalance(
      technician.publicKey
    );
    expect(techBalanceAfter - techBalanceBefore).to.equal(10_000);
    const hospitalBalanceAfter = await provider.connection.getBalance(
      hospital.publicKey
    );
    expect(hospitalBalanceBefore - hospitalBalanceAfter).to.be.at.least(10_000);

    // Nota: getTransaction puede devolver null en localnet
  });

  it("complete_maintenance falla si status no es IssueReported (NoIssueReported)", async () => {
    try {
      await program.methods
        .completeMaintenance()
        .accounts({
          hospital: hospital.publicKey,
          technician: technician.publicKey,
          medicalAsset: medicalAssetPda,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([hospital, technician])
        .rpc();
      expect.fail("Debería haber lanzado NoIssueReported");
    } catch (e: unknown) {
      const msg = e && typeof e === "object" && "message" in e ? String((e as { message: string }).message) : "";
      expect(msg).to.satisfy((m: string) => m.includes("NoIssueReported") || m.includes("6002") || m.includes("0x1772"));
    }
  });

  it("decommission_asset: status Decommissioned y cierra la cuenta", async () => {
    const hospitalBalanceBefore = await provider.connection.getBalance(
      hospital.publicKey
    );

    await program.methods
      .decommissionAsset()
      .accounts({
        hospital: hospital.publicKey,
        medicalAsset: medicalAssetPda,
      })
      .signers([hospital])
      .rpc();

    const accountInfo = await provider.connection.getAccountInfo(
      medicalAssetPda
    );
    expect(accountInfo).to.be.null;

    const hospitalBalanceAfter = await provider.connection.getBalance(
      hospital.publicKey
    );
    expect(hospitalBalanceAfter).to.be.greaterThan(hospitalBalanceBefore);
  });
});
