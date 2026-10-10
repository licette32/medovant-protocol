/**
 * Medovant demo seed script — HK-01 (#74).
 *
 * Prepares the on-chain state needed to record the demo with one command:
 *   1. register_technician (provider wallet, demo mode: hospital == technician)
 *   2. initialize_asset for 3 assets (ids 1, 2, 3 by default)
 *   3. report_issue with escrow on the first asset
 *
 * Idempotent: running it twice does not fail. Every step checks whether the
 * account already exists / is already in the desired state and skips it,
 * printing "(exists)".
 *
 * Usage:
 *   anchor run seed-demo --provider.cluster devnet
 *   # or: yarn seed:demo (honors ANCHOR_PROVIDER_URL)
 *
 * Optional env:
 *   DEMO_ASSET_IDS="1,2,3"        ids to create
 *   DEMO_ISSUE_ASSET_ID="1"       which one carries the escrowed issue
 *   DEMO_REWARD_LAMPORTS="500000" escrow reward (0.0005 SOL)
 *
 * Devnet prototype: targeting the devnet program below only. The script
 * aborts before sending any transaction if the workspace program ID differs.
 */

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { Medovant } from "../target/types/medovant";
import * as fs from "fs";
import * as path from "path";

const EXPECTED_PROGRAM_ID = "5JMd8ADy1KHBhohX6NLbz6WQdyCQTfLd55Gmzo2r34WD";

const DEFAULT_ASSET_IDS = [1, 2, 3];
const DEFAULT_ISSUE_ASSET_ID = 1;
const DEFAULT_REWARD_LAMPORTS = 500_000;

const SIGNATURES_PATH = path.join(__dirname, "..", "docs", "seed-signatures.json");

interface SeedResult {
  step: string;
  address: string;
  signature: string;
}

interface SignatureEntry {
  step: string;
  address: string;
  signature: string;
  timestamp: string;
}

function parseAssetIds(raw: string | undefined): number[] {
  if (!raw) return DEFAULT_ASSET_IDS;
  const ids = raw
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n >= 0);
  return ids.length > 0 ? ids : DEFAULT_ASSET_IDS;
}

async function accountExists(
  connection: anchor.web3.Connection,
  pubkey: PublicKey
): Promise<boolean> {
  const info = await connection.getAccountInfo(pubkey);
  return info !== null;
}

/**
 * Appends only fresh signatures to docs/seed-signatures.json.
 * Steps that were skipped ("-" signature) are ignored. Previous entries are
 * never overwritten: the file is read first (when present) and merged.
 * When there are no new signatures, nothing is written.
 */
function appendSignatures(
  programId: string,
  cluster: string,
  results: SeedResult[]
): void {
  const fresh = results.filter((r) => r.signature !== "-");
  if (fresh.length === 0) {
    console.log("no new signatures — signatures file left untouched.");
    return;
  }

  const timestamp = new Date().toISOString();
  const newEntries: SignatureEntry[] = fresh.map((r) => ({
    step: r.step,
    address: r.address,
    signature: r.signature,
    timestamp,
  }));

  let previous: SignatureEntry[] = [];
  if (fs.existsSync(SIGNATURES_PATH)) {
    try {
      const raw = fs.readFileSync(SIGNATURES_PATH, "utf8");
      const parsed = JSON.parse(raw) as { entries?: unknown };
      if (Array.isArray(parsed.entries)) {
        previous = (parsed.entries as SignatureEntry[]).filter(
          (e) =>
            e &&
            typeof e.step === "string" &&
            typeof e.address === "string" &&
            typeof e.signature === "string"
        );
      }
    } catch (e) {
      throw new Error(
        `cannot merge signatures: existing ${SIGNATURES_PATH} is not valid JSON`
      );
    }
  }

  const payload = {
    programId,
    cluster,
    entries: [...previous, ...newEntries],
  };
  fs.mkdirSync(path.dirname(SIGNATURES_PATH), { recursive: true });
  fs.writeFileSync(SIGNATURES_PATH, JSON.stringify(payload, null, 2) + "\n");
  console.log(
    `saved ${newEntries.length} new signature(s) to docs/seed-signatures.json (${previous.length} previous kept).`
  );
}

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Medovant as Program<Medovant>;

  const actualProgramId = program.programId.toBase58();
  if (actualProgramId !== EXPECTED_PROGRAM_ID) {
    throw new Error(
      `unexpected program ID ${actualProgramId} (expected ${EXPECTED_PROGRAM_ID}). ` +
        `Point the workspace to the devnet program before seeding.`
    );
  }

  const hospital = provider.wallet.publicKey;
  const connection = provider.connection;
  const cluster =
    (connection as unknown as { rpcEndpoint?: string }).rpcEndpoint ??
    process.env.ANCHOR_PROVIDER_URL ??
    "unknown";

  const assetIds = parseAssetIds(process.env.DEMO_ASSET_IDS);
  const issueAssetId =
    Number(process.env.DEMO_ISSUE_ASSET_ID ?? DEFAULT_ISSUE_ASSET_ID) ||
    DEFAULT_ISSUE_ASSET_ID;
  const rewardLamports = Number(
    process.env.DEMO_REWARD_LAMPORTS ?? DEFAULT_REWARD_LAMPORTS
  );

  if (!assetIds.includes(issueAssetId)) {
    throw new Error(
      `DEMO_ISSUE_ASSET_ID (${issueAssetId}) must be included in DEMO_ASSET_IDS (${assetIds.join(",")})`
    );
  }
  if (!Number.isInteger(rewardLamports) || rewardLamports <= 0) {
    throw new Error(`DEMO_REWARD_LAMPORTS must be an integer greater than zero`);
  }

  console.log(`hospital/technician (demo wallet): ${hospital.toBase58()}`);
  console.log(`program: ${actualProgramId}`);
  console.log(`cluster: ${cluster}`);
  console.log(
    `assets: [${assetIds.join(", ")}] · issue+escrow on asset ${issueAssetId} (${rewardLamports} lamports)`
  );

  // Fresh devnet wallet: warn (and try an airdrop) when funds are too low for fees.
  const balance = await connection.getBalance(hospital);
  console.log(`balance: ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL`);
  const MIN_BALANCE = 0.05 * LAMPORTS_PER_SOL;
  if (balance < MIN_BALANCE) {
    console.log("low balance — requesting a 1 SOL airdrop...");
    try {
      const sig = await connection.requestAirdrop(hospital, LAMPORTS_PER_SOL);
      await connection.confirmTransaction(sig, "confirmed");
      const after = await connection.getBalance(hospital);
      console.log(
        `airdrop ok: ${(after / LAMPORTS_PER_SOL).toFixed(4)} SOL (sig ${sig})`
      );
    } catch (e) {
      console.warn(
        "airdrop failed (devnet rate limit?). Fund the wallet and retry."
      );
    }
  }

  const results: SeedResult[] = [];

  // 1) register_technician (idempotent)
  const [technicianProfilePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("technician"), hospital.toBuffer()],
    program.programId
  );
  if (await accountExists(connection, technicianProfilePda)) {
    console.log(`technician profile exists: ${technicianProfilePda.toBase58()}`);
    results.push({
      step: "register_technician (exists)",
      address: technicianProfilePda.toBase58(),
      signature: "-",
    });
  } else {
    try {
      const sig = await program.methods
        .registerTechnician()
        .accounts({
          technician: hospital,
        })
        .rpc();
      console.log(
        `register_technician ok: profile ${technicianProfilePda.toBase58()} (sig ${sig})`
      );
      results.push({
        step: "register_technician",
        address: technicianProfilePda.toBase58(),
        signature: sig,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("already in use")) {
        console.log(
          `technician profile already exists: ${technicianProfilePda.toBase58()}`
        );
        results.push({
          step: "register_technician (exists)",
          address: technicianProfilePda.toBase58(),
          signature: "-",
        });
      } else {
        throw e;
      }
    }
  }

  // 2) initialize_asset x3 (idempotent)
  const assetPdas = new Map<number, PublicKey>();
  for (const id of assetIds) {
    const assetId = new anchor.BN(id);
    const [assetPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("equipment"),
        hospital.toBuffer(),
        assetId.toArrayLike(Buffer, "le", 8),
      ],
      program.programId
    );
    assetPdas.set(id, assetPda);

    if (await accountExists(connection, assetPda)) {
      console.log(`asset ${id} exists: ${assetPda.toBase58()}`);
      results.push({
        step: `initialize_asset(${id}) (exists)`,
        address: assetPda.toBase58(),
        signature: "-",
      });
      continue;
    }
    try {
      const sig = await program.methods
        .initializeAsset(assetId)
        .accounts({
          hospital,
        })
        .rpc();
      console.log(`initialize_asset(${id}) ok: ${assetPda.toBase58()} (sig ${sig})`);
      results.push({
        step: `initialize_asset(${id})`,
        address: assetPda.toBase58(),
        signature: sig,
      });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("already in use")) {
        console.log(`asset ${id} already exists: ${assetPda.toBase58()}`);
        results.push({
          step: `initialize_asset(${id}) (exists)`,
          address: assetPda.toBase58(),
          signature: "-",
        });
      } else {
        throw e;
      }
    }
  }

  // 3) report_issue with escrow on the chosen asset (idempotent)
  const issuePda = assetPdas.get(issueAssetId)!;
  const [vaultPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), issuePda.toBuffer()],
    program.programId
  );
  const asset = await program.account.medicalAsset.fetch(issuePda);
  const statusKey = Object.keys(asset.status)[0];
  if (statusKey === "issueReported") {
    console.log(
      `asset ${issueAssetId} already has a reported issue — skipping. vault ${vaultPda.toBase58()}`
    );
    results.push({
      step: `report_issue(${issueAssetId}) (exists)`,
      address: vaultPda.toBase58(),
      signature: "-",
    });
  } else if (statusKey !== "active") {
    console.warn(
      `asset ${issueAssetId} is "${statusKey}" — cannot report an issue (only Active -> IssueReported). Skipping.`
    );
    results.push({
      step: `report_issue(${issueAssetId}) (skipped: ${statusKey})`,
      address: vaultPda.toBase58(),
      signature: "-",
    });
  } else {
    const sig = await program.methods
      .reportIssue(new anchor.BN(rewardLamports))
      .accounts({
        hospital,
        medicalAsset: issuePda,
        escrowVault: vaultPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    console.log(
      `report_issue(${issueAssetId}) ok: vault ${vaultPda.toBase58()} (sig ${sig})`
    );
    results.push({
      step: `report_issue(${issueAssetId})`,
      address: vaultPda.toBase58(),
      signature: sig,
    });
  }

  // Summary: addresses + signatures
  console.log("\n— demo seed done —");
  for (const r of results) {
    console.log(`${r.step}\n  address: ${r.address}\n  signature: ${r.signature}`);
  }
  console.log(
    `\nDemo state: technician registered + ${assetIds.length} assets + escrowed issue on asset ${issueAssetId}.`
  );

  appendSignatures(actualProgramId, cluster, results);
}

main().catch((e) => {
  console.error("seed-demo failed:", e);
  process.exit(1);
});
