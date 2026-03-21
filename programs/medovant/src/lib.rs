//! Medovant – maintenance escrow for medical equipment on Solana (Anchor, PDAs, CRUD, events).

use anchor_lang::prelude::*;
use anchor_lang::system_program;

declare_id!("5JMd8ADy1KHBhohX6NLbz6WQdyCQTfLd55Gmzo2r34WD");

/// Lamports transferred from hospital to technician when maintenance is completed.
pub const MAINTENANCE_FEE_LAMPORTS: u64 = 10_000;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
#[repr(u8)]
pub enum AssetStatus {
    Active = 0,
    IssueReported = 1,
    UnderMaintenance = 2,
    Decommissioned = 3,
}

#[error_code]
pub enum MedovantError {
    #[msg("Solo el hospital dueño puede realizar esta acción")]
    UnauthorizedHospital,

    #[msg("El equipo debe estar en estado Active para reportar una avería")]
    AssetNotActive,

    #[msg("No hay avería reportada; el equipo debe estar en estado IssueReported")]
    NoIssueReported,

    #[msg("Saldo insuficiente para pagar la tarifa de mantenimiento al técnico")]
    InsufficientBalanceForMaintenanceFee,
}

#[event]
pub struct AssetInitialized {
    pub hospital: Pubkey,
    pub asset_id: u64,
    pub timestamp: i64,
}

#[event]
pub struct IssueReported {
    pub hospital: Pubkey,
    pub asset_id: u64,
    pub timestamp: i64,
}

#[event]
pub struct MaintenanceCompleted {
    pub hospital: Pubkey,
    pub asset_id: u64,
    pub technician: Pubkey,
    pub timestamp: i64,
}

/// On-chain account for one medical equipment item (PDA). Fixed size: 58 bytes.
#[account]
pub struct MedicalAsset {
    pub hospital: Pubkey,
    pub asset_id: u64,
    pub status: AssetStatus,
    pub last_maintenance: i64,
    pub bump: u8,
}

impl MedicalAsset {
    pub const LEN: usize = 8 + 32 + 8 + 1 + 8 + 1;
}

#[program]
pub mod medovant {
    use super::*;

    // Registers a new equipment PDA for this hospital and asset_id.
    // Accounts: hospital (signer, payer), medical_asset (init PDA), system_program.
    // State: creates MedicalAsset with status Active and last_maintenance = now.
    // Emits: AssetInitialized.
    pub fn initialize_asset(ctx: Context<InitializeAsset>, asset_id: u64) -> Result<()> {
        let asset = &mut ctx.accounts.medical_asset;
        let now = Clock::get()?.unix_timestamp;

        asset.hospital = ctx.accounts.hospital.key();
        asset.asset_id = asset_id;
        asset.status = AssetStatus::Active;
        asset.last_maintenance = now;
        asset.bump = ctx.bumps.medical_asset;

        emit!(AssetInitialized {
            hospital: asset.hospital,
            asset_id: asset.asset_id,
            timestamp: now,
        });

        Ok(())
    }

    // Hospital reports an issue; only allowed when equipment is Active.
    // Accounts: hospital (signer, must own PDA via has_one), medical_asset (mut PDA).
    // State: Active -> IssueReported.
    // Emits: IssueReported.
    pub fn report_issue(ctx: Context<ReportIssue>) -> Result<()> {
        let asset = &mut ctx.accounts.medical_asset;
        let now = Clock::get()?.unix_timestamp;

        require!(
            asset.status == AssetStatus::Active,
            MedovantError::AssetNotActive
        );

        asset.status = AssetStatus::IssueReported;

        emit!(IssueReported {
            hospital: asset.hospital,
            asset_id: asset.asset_id,
            timestamp: now,
        });

        Ok(())
    }

    // Completes maintenance: escrows MAINTENANCE_FEE_LAMPORTS from hospital to technician via System Program CPI.
    // Accounts: hospital (signer, mut), technician (signer, mut), medical_asset (mut PDA), system_program.
    // State: IssueReported -> Active; last_maintenance = now. Requires hospital balance >= fee.
    // Emits: MaintenanceCompleted.
    pub fn complete_maintenance(ctx: Context<CompleteMaintenance>) -> Result<()> {
        let asset = &mut ctx.accounts.medical_asset;
        let now = Clock::get()?.unix_timestamp;

        require!(
            asset.status == AssetStatus::IssueReported,
            MedovantError::NoIssueReported
        );

        let hospital_lamports = ctx.accounts.hospital.to_account_info().lamports();
        require!(
            hospital_lamports >= MAINTENANCE_FEE_LAMPORTS,
            MedovantError::InsufficientBalanceForMaintenanceFee
        );

        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.hospital.to_account_info(),
                    to: ctx.accounts.technician.to_account_info(),
                },
            ),
            MAINTENANCE_FEE_LAMPORTS,
        )?;

        asset.status = AssetStatus::Active;
        asset.last_maintenance = now;

        emit!(MaintenanceCompleted {
            hospital: asset.hospital,
            asset_id: asset.asset_id,
            technician: ctx.accounts.technician.key(),
            timestamp: now,
        });

        Ok(())
    }

    // Hospital decommissions equipment; PDA is closed and rent returned to hospital.
    // Accounts: hospital (signer), medical_asset (mut PDA, close = hospital, has_one hospital).
    // State: sets Decommissioned then Anchor closes the account.
    // Emits: none.
    pub fn decommission_asset(ctx: Context<DecommissionAsset>) -> Result<()> {
        let asset = &mut ctx.accounts.medical_asset;
        asset.status = AssetStatus::Decommissioned;
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(asset_id: u64)]
pub struct InitializeAsset<'info> {
    #[account(mut)]
    pub hospital: Signer<'info>,

    #[account(
        init,
        payer = hospital,
        space = 8 + 32 + 8 + 1 + 8 + 1,
        seeds = [b"equipment", hospital.key().as_ref(), &asset_id.to_le_bytes()],
        bump
    )]
    pub medical_asset: Account<'info, MedicalAsset>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ReportIssue<'info> {
    pub hospital: Signer<'info>,

    #[account(
        mut,
        has_one = hospital,
        seeds = [b"equipment", hospital.key().as_ref(), &medical_asset.asset_id.to_le_bytes()],
        bump = medical_asset.bump
    )]
    pub medical_asset: Account<'info, MedicalAsset>,
}

#[derive(Accounts)]
pub struct CompleteMaintenance<'info> {
    #[account(mut)]
    pub hospital: Signer<'info>,

    #[account(mut)]
    pub technician: Signer<'info>,

    #[account(
        mut,
        seeds = [b"equipment", medical_asset.hospital.as_ref(), &medical_asset.asset_id.to_le_bytes()],
        bump = medical_asset.bump
    )]
    pub medical_asset: Account<'info, MedicalAsset>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DecommissionAsset<'info> {
    #[account(mut)]
    pub hospital: Signer<'info>,

    #[account(
        mut,
        close = hospital,
        has_one = hospital,
        seeds = [b"equipment", hospital.key().as_ref(), &medical_asset.asset_id.to_le_bytes()],
        bump = medical_asset.bump
    )]
    pub medical_asset: Account<'info, MedicalAsset>,
}
