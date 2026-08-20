/**
 * Medovant integration tests: technician profile, asset lifecycle, escrow, decommission.
 */

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Medovant } from "../target/types/medovant";
import { PublicKey, Keypair, LAMPORTS_PER_SOL, SystemProgram } from "@solana/web3.js";
import { expect } from "chai";

const REWARD_LAMPORTS = 500_000;

describe("medovant", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.Medovant as Program<Medovant>;

  const hospital = Keypair.generate();
  const rogueHospital = Keypair.generate();
  const technician = Keypair.generate();
  const assetId = new anchor.BN(1);

  let medicalAssetPda: PublicKey;
  let medicalAssetBump: number;
  let escrowVaultPda: PublicKey;
  let technicianProfilePda: PublicKey;

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

    const sigRogue = await provider.connection.requestAirdrop(
      rogueHospital.publicKey,
      LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(sigRogue);

    [medicalAssetPda, medicalAssetBump] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("equipment"),
        hospital.publicKey.toBuffer(),
        assetId.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );

    [escrowVaultPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), medicalAssetPda.toBuffer()],
      program.programId
    );

    [technicianProfilePda] = PublicKey.findProgramAddressSync(
      [Buffer.from("technician"), technician.publicKey.toBuffer()],
      program.programId
    );
  });

  it("register_technician: creates technician profile", async () => {
    await program.methods
      .registerTechnician()
      .accounts({
        technician: technician.publicKey,
        technicianProfile: technicianProfilePda,
        systemProgram: SystemProgram.programId,
      })
      .signers([technician])
      .rpc();

    const profile = await program.account.technicianProfile.fetch(
      technicianProfilePda
    );
    expect(profile.jobsCompleted).to.equal(0);
    expect(profile.totalEarned.toString()).to.equal("0");
    expect(profile.technician.toString()).to.equal(
      technician.publicKey.toString()
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
    expect(account.maintenanceReward.toString()).to.equal("0");
    expect(account.failureCount).to.equal(0);

    // Nota: getTransaction puede devolver null en localnet; la lógica se verifica con account.status
  });

  it("report_issue con reward 0 falla con RewardTooLow", async () => {
    try {
      await program.methods
        .reportIssue(new anchor.BN(0))
        .accounts({
          hospital: hospital.publicKey,
          medicalAsset: medicalAssetPda,
          escrowVault: escrowVaultPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([hospital])
        .rpc();
      expect.fail("Debería haber lanzado RewardTooLow");
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "message" in e
          ? String((e as { message: string }).message)
          : "";
      expect(msg).to.satisfy(
        (m: string) =>
          m.includes("RewardTooLow") || m.includes("6003") || m.includes("0x1773")
      );
    }
  });

  it("report_issue: solo si status es Active, pasa a IssueReported", async () => {
    const tx = await program.methods
      .reportIssue(new anchor.BN(REWARD_LAMPORTS))
      .accounts({
        hospital: hospital.publicKey,
        medicalAsset: medicalAssetPda,
        escrowVault: escrowVaultPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([hospital])
      .rpc();

    const account = await program.account.medicalAsset.fetch(medicalAssetPda);
    expect(account.status).to.exist;
    expect(account.status).to.include.keys("issueReported");
    expect(account.failureCount).to.equal(1);
    expect(account.maintenanceReward.toString()).to.equal(
      REWARD_LAMPORTS.toString()
    );

    // Nota: getTransaction puede devolver null en localnet
  });

  it("report_issue falla si status no es Active (ya IssueReported)", async () => {
    try {
      await program.methods
        .reportIssue(new anchor.BN(1))
        .accounts({
          hospital: hospital.publicKey,
          medicalAsset: medicalAssetPda,
          escrowVault: escrowVaultPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([hospital])
        .rpc();
      expect.fail("Debería haber lanzado AssetNotActive");
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "message" in e
          ? String((e as { message: string }).message)
          : "";
      expect(msg).to.satisfy(
        (m: string) =>
          m.includes("AssetNotActive") || m.includes("6001") || m.includes("0x1771")
      );
    }
  });

  it("complete_maintenance: solo si IssueReported → Active, actualiza last_maintenance y paga al técnico", async () => {
    const techBalanceBefore = await provider.connection.getBalance(
      technician.publicKey
    );

    const tx = await program.methods
      .completeMaintenance()
      .accounts({
        hospital: hospital.publicKey,
        technician: technician.publicKey,
        medicalAsset: medicalAssetPda,
        escrowVault: escrowVaultPda,
        technicianProfile: technicianProfilePda,
        systemProgram: SystemProgram.programId,
      })
      .signers([hospital, technician])
      .rpc();

    const assetAfter = await program.account.medicalAsset.fetch(medicalAssetPda);
    expect(assetAfter.status).to.exist;
    expect(assetAfter.status).to.include.keys("active");
    expect(assetAfter.lastMaintenance.toNumber()).to.be.greaterThan(0);
    expect(assetAfter.maintenanceReward.toString()).to.equal("0");

    const techBalanceAfter = await provider.connection.getBalance(
      technician.publicKey
    );
    expect(techBalanceAfter - techBalanceBefore).to.equal(REWARD_LAMPORTS);

    const profile = await program.account.technicianProfile.fetch(
      technicianProfilePda
    );
    expect(profile.jobsCompleted).to.equal(1);
    expect(profile.totalEarned.toString()).to.equal(
      REWARD_LAMPORTS.toString()
    );
  });

  it("complete_maintenance falla si el hospital firmante no coincide con medical_asset.hospital (has_one)", async () => {
    try {
      await program.methods
        .completeMaintenance()
        .accounts({
          hospital: rogueHospital.publicKey,
          technician: technician.publicKey,
          medicalAsset: medicalAssetPda,
          escrowVault: escrowVaultPda,
          technicianProfile: technicianProfilePda,
          systemProgram: SystemProgram.programId,
        })
        .signers([rogueHospital, technician])
        .rpc();
      expect.fail("Debería haber lanzado un error de constraint has_one");
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "message" in e
          ? String((e as { message: string }).message)
          : "";
      expect(msg).to.satisfy(
        (m: string) =>
          m.toLowerCase().includes("has one") ||
          m.includes("2027") ||
          m.includes("0x7eb")
      );
    }
  });

  it("complete_maintenance falla si status no es IssueReported (NoIssueReported)", async () => {
    try {
      await program.methods
        .completeMaintenance()
        .accounts({
          hospital: hospital.publicKey,
          technician: technician.publicKey,
          medicalAsset: medicalAssetPda,
          escrowVault: escrowVaultPda,
          technicianProfile: technicianProfilePda,
          systemProgram: SystemProgram.programId,
        })
        .signers([hospital, technician])
        .rpc();
      expect.fail("Debería haber lanzado NoIssueReported");
    } catch (e: unknown) {
      const msg =
        e && typeof e === "object" && "message" in e
          ? String((e as { message: string }).message)
          : "";
      expect(msg).to.satisfy(
        (m: string) =>
          m.includes("NoIssueReported") || m.includes("6002") || m.includes("0x1772")
      );
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
        escrowVault: escrowVaultPda,
        systemProgram: SystemProgram.programId,
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

  describe("medovant edge cases (#7)", () => {
    const assetId2 = new anchor.BN(2);
    const unregisteredTech = Keypair.generate();
    const rogueTech = Keypair.generate();

    let asset2Pda: PublicKey;
    let asset2Vault: PublicKey;
    let unregisteredProfilePda: PublicKey;

    before(async () => {
      for (const kp of [unregisteredTech, rogueTech]) {
        const sig = await provider.connection.requestAirdrop(
          kp.publicKey,
          LAMPORTS_PER_SOL
        );
        await provider.connection.confirmTransaction(sig);
      }

      [asset2Pda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("equipment"),
          hospital.publicKey.toBuffer(),
          assetId2.toArrayLike(Buffer, "le", 8),
        ],
        program.programId
      );
      [asset2Vault] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), asset2Pda.toBuffer()],
        program.programId
      );
      [unregisteredProfilePda] = PublicKey.findProgramAddressSync(
        [Buffer.from("technician"), unregisteredTech.publicKey.toBuffer()],
        program.programId
      );

      await program.methods
        .initializeAsset(assetId2)
        .accounts({
          hospital: hospital.publicKey,
          medicalAsset: asset2Pda,
          systemProgram: SystemProgram.programId,
        })
        .signers([hospital])
        .rpc();

      await program.methods
        .reportIssue(new anchor.BN(REWARD_LAMPORTS))
        .accounts({
          hospital: hospital.publicKey,
          medicalAsset: asset2Pda,
          escrowVault: asset2Vault,
          systemProgram: SystemProgram.programId,
        })
        .signers([hospital])
        .rpc();
    });

    function extractMessage(e: unknown): string {
      return e && typeof e === "object" && "message" in e
        ? String((e as { message: string }).message)
        : "";
    }

    function expectFailure(promise: Promise<unknown>, patterns: string[]): Promise<void> {
      return promise.then(
        () => {
          expect.fail("Se esperaba que la transacción fallara");
        },
        (e: unknown) => {
          const msg = extractMessage(e);
          expect(msg.length).to.be.greaterThan(0);
          expect(msg.toLowerCase()).to.satisfy((m: string) =>
            patterns.some((p) => m.includes(p.toLowerCase()))
          );
        }
      );
    }

    it("register_technician twice falla (PDA ya inicializado)", async () => {
      await expectFailure(
        program.methods
          .registerTechnician()
          .accounts({
            technician: technician.publicKey,
            technicianProfile: technicianProfilePda,
            systemProgram: SystemProgram.programId,
          })
          .signers([technician])
          .rpc(),
        ["already", "discriminator", "in use", "0x1770"]
      );
    });

    it("complete_maintenance con técnico sin registrar falla", async () => {
      await expectFailure(
        program.methods
          .completeMaintenance()
          .accounts({
            hospital: hospital.publicKey,
            technician: unregisteredTech.publicKey,
            medicalAsset: asset2Pda,
            escrowVault: asset2Vault,
            technicianProfile: unregisteredProfilePda,
            systemProgram: SystemProgram.programId,
          })
          .signers([hospital, unregisteredTech])
          .rpc(),
        ["not found", "not exist", "account"]
      );
    });

    it("complete_maintenance con firmante técnico distinto falla", async () => {
      await expectFailure(
        program.methods
          .completeMaintenance()
          .accounts({
            hospital: hospital.publicKey,
            technician: rogueTech.publicKey,
            medicalAsset: asset2Pda,
            escrowVault: asset2Vault,
            technicianProfile: technicianProfilePda,
            systemProgram: SystemProgram.programId,
          })
          .signers([hospital, rogueTech])
          .rpc(),
        ["seeds", "constraint", "has one", "technicianprofile"]
      );
    });

    it("decommission_asset con escrow activo falla (SOL protegido en vault)", async () => {
      const vaultBalanceBefore = await provider.connection.getBalance(asset2Vault);
      expect(vaultBalanceBefore).to.be.greaterThan(0);

      await expectFailure(
        program.methods
          .decommissionAsset()
          .accounts({
            hospital: hospital.publicKey,
            medicalAsset: asset2Pda,
            escrowVault: asset2Vault,
            systemProgram: SystemProgram.programId,
          })
          .signers([hospital])
          .rpc(),
        ["AssetHasPendingEscrow", "6005", "0x1775"]
      );

      const assetInfo = await provider.connection.getAccountInfo(asset2Pda);
      expect(assetInfo).to.not.be.null;

      const vaultBalanceAfter = await provider.connection.getBalance(asset2Vault);
      expect(vaultBalanceAfter).to.equal(vaultBalanceBefore);
    });

    it("decommission_asset con vault drenado: libera el rent del vault al hospital", async () => {
      await program.methods
        .completeMaintenance()
        .accounts({
          hospital: hospital.publicKey,
          technician: technician.publicKey,
          medicalAsset: asset2Pda,
          escrowVault: asset2Vault,
          technicianProfile: technicianProfilePda,
          systemProgram: SystemProgram.programId,
        })
        .signers([hospital, technician])
        .rpc();

      const vaultBalanceBefore = await provider.connection.getBalance(asset2Vault);
      expect(vaultBalanceBefore).to.be.greaterThan(0);

      const hospitalBalanceBefore = await provider.connection.getBalance(
        hospital.publicKey
      );

      await program.methods
        .decommissionAsset()
        .accounts({
          hospital: hospital.publicKey,
          medicalAsset: asset2Pda,
          escrowVault: asset2Vault,
          systemProgram: SystemProgram.programId,
        })
        .signers([hospital])
        .rpc();

      const assetInfo = await provider.connection.getAccountInfo(asset2Pda);
      expect(assetInfo).to.be.null;

      const vaultBalanceAfter = await provider.connection.getBalance(asset2Vault);
      expect(vaultBalanceAfter).to.equal(0);

      const hospitalBalanceAfter = await provider.connection.getBalance(
        hospital.publicKey
      );
      expect(hospitalBalanceAfter).to.be.greaterThan(hospitalBalanceBefore);
    });
  });
});
