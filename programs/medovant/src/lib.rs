//! Medovant – maintenance escrow for medical equipment on Solana (Anchor, PDAs, CRUD, events).

use anchor_lang::prelude::*;
use anchor_lang::solana_program::system_program as system_program_id;
use anchor_lang::system_program;

declare_id!("5JMd8ADy1KHBhohX6NLbz6WQdyCQTfLd55Gmzo2r34WD");

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

    #[msg("Maintenance reward must be greater than zero")]
    RewardTooLow,
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

/// On-chain account for one medical equipment item (PDA). Fixed size: 70 bytes (discriminator + data).
#[account]
pub struct MedicalAsset {
    pub hospital: Pubkey,
    pub asset_id: u64,
    pub status: AssetStatus,
    pub last_maintenance: i64,
    pub bump: u8,
    /// Lamports locked in the escrow vault PDA for the pending maintenance payout.
    pub maintenance_reward: u64,
    /// Total number of issues reported on-chain for this asset.
    pub failure_count: u32,
}

impl MedicalAsset {
    /// Account data size excluding 8-byte Anchor discriminator (62 bytes).
    pub const INIT_SPACE: usize = 32 + 8 + 1 + 8 + 1 + 8 + 4;
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
        asset.maintenance_reward = 0;
        asset.failure_count = 0;

        emit!(AssetInitialized {
            hospital: asset.hospital,
            asset_id: asset.asset_id,
            timestamp: now,
        });

        Ok(())
    }

    // Hospital locks `reward` lamports into the system-owned escrow vault PDA and marks an issue.
    // Vault is created on first use via CPI create_account (owner = System Program, space 0) + invoke_signed.
    // Accounts: hospital (mut signer), medical_asset (mut PDA), escrow_vault (mut PDA, seeds), system_program.
    // State: Active -> IssueReported; maintenance_reward = reward; failure_count += 1.
    // Emits: IssueReported.
    pub fn report_issue(ctx: Context<ReportIssue>, reward: u64) -> Result<()> {
        require!(reward > 0, MedovantError::RewardTooLow);

        {
            let asset = &ctx.accounts.medical_asset;
            require!(asset.status == AssetStatus::Active, MedovantError::AssetNotActive);
        }

        let vault_ai = ctx.accounts.escrow_vault.to_account_info();
        if vault_ai.lamports() == 0 {
            let medical_key = ctx.accounts.medical_asset.key();
            let bump = ctx.bumps.escrow_vault;
            let seeds = &[
                b"vault".as_ref(),
                medical_key.as_ref(),
                &[bump],
            ];
            let signer = &[&seeds[..]];

            let rent = Rent::get()?;
            let lamports = rent.minimum_balance(0);

            system_program::create_account(
                CpiContext::new_with_signer(
                    ctx.accounts.system_program.to_account_info(),
                    system_program::CreateAccount {
                        from: ctx.accounts.hospital.to_account_info(),
                        to: vault_ai.clone(),
                    },
                    signer,
                ),
                lamports,
                0,
                &system_program_id::ID,
            )?;
        }

        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.hospital.to_account_info(),
                    to: ctx.accounts.escrow_vault.to_account_info(),
                },
            ),
            reward,
        )?;

        let asset = &mut ctx.accounts.medical_asset;
        let now = Clock::get()?.unix_timestamp;
        asset.maintenance_reward = reward;
        asset.failure_count = asset.failure_count.saturating_add(1);
        asset.status = AssetStatus::IssueReported;

        emit!(IssueReported {
            hospital: asset.hospital,
            asset_id: asset.asset_id,
            timestamp: now,
        });

        Ok(())
    }

    // Pays locked reward from the system-owned escrow vault PDA to the technician (CPI + invoke_signed).
    // Accounts: hospital (signer), technician (signer), medical_asset (mut PDA), escrow_vault (mut PDA), system_program.
    // State: IssueReported -> Active; maintenance_reward = 0; last_maintenance = now.
    // Emits: MaintenanceCompleted.
    pub fn complete_maintenance(ctx: Context<CompleteMaintenance>) -> Result<()> {
        require!(
            ctx.accounts.medical_asset.status == AssetStatus::IssueReported,
            MedovantError::NoIssueReported
        );

        let reward_amount = ctx.accounts.medical_asset.maintenance_reward;

        let medical_key = ctx.accounts.medical_asset.key();
        let bump = ctx.bumps.escrow_vault;
        let seeds = &[
            b"vault".as_ref(),
            medical_key.as_ref(),
            &[bump],
        ];
        let signer = &[&seeds[..]];

        system_program::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.escrow_vault.to_account_info(),
                    to: ctx.accounts.technician.to_account_info(),
                },
                signer,
            ),
            reward_amount,
        )?;

        let asset = &mut ctx.accounts.medical_asset;
        let now = Clock::get()?.unix_timestamp;
        asset.maintenance_reward = 0;
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
        space = 8 + MedicalAsset::INIT_SPACE,
        seeds = [b"equipment", hospital.key().as_ref(), &asset_id.to_le_bytes()],
        bump
    )]
    pub medical_asset: Account<'info, MedicalAsset>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(reward: u64)]
pub struct ReportIssue<'info> {
    #[account(mut)]
    pub hospital: Signer<'info>,

    #[account(
        mut,
        seeds = [b"equipment", hospital.key().as_ref(), &medical_asset.asset_id.to_le_bytes()],
        bump = medical_asset.bump,
        has_one = hospital,
    )]
    pub medical_asset: Account<'info, MedicalAsset>,

    #[account(
        mut,
        seeds = [b"vault", medical_asset.key().as_ref()],
        bump
    )]
    /// CHECK: System-owned vault PDA (space 0); created via CPI in report_issue if empty.
    pub escrow_vault: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
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

    #[account(
        mut,
        seeds = [b"vault", medical_asset.key().as_ref()],
        bump
    )]
    /// CHECK: System-owned vault PDA, escrow lamports only
    pub escrow_vault: UncheckedAccount<'info>,

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
