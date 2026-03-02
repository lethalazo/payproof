use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer, Mint};

declare_id!("GigEY98avKBtVEtJpqytTdSfEaCnULZNuE5Nyx98R7Yh");

#[program]
pub mod htlc_solana {
    use super::*;

    pub fn initialize_config(ctx: Context<InitializeConfig>, treasury: Pubkey) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.admin = ctx.accounts.admin.key();
        config.treasury = treasury;
        Ok(())
    }

    pub fn lock(
        ctx: Context<LockFunds>,
        lock_id: [u8; 32],
        hashlock: [u8; 32],
        amount: u64,
        timelock: i64,
    ) -> Result<()> {
        let lock = &mut ctx.accounts.lock_account;
        lock.sender = ctx.accounts.sender.key();
        lock.recipient = ctx.accounts.recipient.key();
        lock.mint = ctx.accounts.token_mint.key();
        lock.amount = amount;
        lock.hashlock = hashlock;
        lock.timelock = timelock;
        lock.state = LockState::Locked;
        lock.lock_id = lock_id;
        lock.bump = ctx.bumps.escrow;
        lock.data_deadline = 0;
        lock.data_hash = [0u8; 32];
        lock.receipt_hash = [0u8; 32];

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.sender_token.to_account_info(),
                    to: ctx.accounts.escrow.to_account_info(),
                    authority: ctx.accounts.sender.to_account_info(),
                },
            ),
            amount,
        )?;

        emit!(LockedEvent {
            lock_id,
            sender: lock.sender,
            recipient: lock.recipient,
            hashlock,
            amount,
            timelock,
        });
        Ok(())
    }

    pub fn post_data_hash(ctx: Context<PostDataHash>, data_hash: [u8; 32]) -> Result<()> {
        let lock = &mut ctx.accounts.lock_account;
        require!(lock.state == LockState::Locked, HtlcError::NotLocked);

        let clock = Clock::get()?;
        require!(clock.unix_timestamp < lock.timelock, HtlcError::Expired);
        require!(
            ctx.accounts.recipient.key() == lock.recipient,
            HtlcError::NotRecipient
        );

        lock.data_hash = data_hash;
        lock.data_deadline = clock.unix_timestamp + CONFIRMATION_WINDOW;
        lock.state = LockState::DataPosted;

        emit!(DataPostedEvent {
            lock_id: lock.lock_id,
            data_hash,
            data_deadline: lock.data_deadline,
        });
        Ok(())
    }

    pub fn confirm_receipt(ctx: Context<ConfirmReceipt>, receipt_hash: [u8; 32]) -> Result<()> {
        let lock = &mut ctx.accounts.lock_account;
        require!(lock.state == LockState::DataPosted, HtlcError::NotDataPosted);

        let clock = Clock::get()?;
        require!(
            clock.unix_timestamp < lock.data_deadline,
            HtlcError::DeadlinePassed
        );
        require!(
            ctx.accounts.sender.key() == lock.sender,
            HtlcError::NotSender
        );
        require!(receipt_hash == lock.data_hash, HtlcError::HashMismatch);

        lock.receipt_hash = receipt_hash;
        lock.state = LockState::Confirmed;

        emit!(ReceiptConfirmedEvent {
            lock_id: lock.lock_id,
            receipt_hash,
        });
        Ok(())
    }

    pub fn claim(ctx: Context<ClaimFunds>, preimage: [u8; 32]) -> Result<()> {
        let lock = &mut ctx.accounts.lock_account;
        require!(lock.state == LockState::Confirmed, HtlcError::NotConfirmed);

        let hash = anchor_lang::solana_program::hash::hashv(&[&preimage]);
        require!(hash.to_bytes() == lock.hashlock, HtlcError::BadPreimage);

        lock.state = LockState::Claimed;

        let seeds = &[b"escrow", lock.lock_id.as_ref(), &[lock.bump]];
        let signer_seeds = &[&seeds[..]];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.escrow.to_account_info(),
                    to: ctx.accounts.recipient_token.to_account_info(),
                    authority: ctx.accounts.escrow.to_account_info(),
                },
                signer_seeds,
            ),
            lock.amount,
        )?;

        emit!(ClaimedEvent {
            lock_id: lock.lock_id,
            preimage,
        });
        Ok(())
    }

    pub fn refund(ctx: Context<RefundFunds>) -> Result<()> {
        let lock = &mut ctx.accounts.lock_account;
        require!(lock.state == LockState::Locked, HtlcError::NotLocked);

        let clock = Clock::get()?;
        require!(clock.unix_timestamp >= lock.timelock, HtlcError::NotExpired);

        lock.state = LockState::Refunded;

        let seeds = &[b"escrow", lock.lock_id.as_ref(), &[lock.bump]];
        let signer_seeds = &[&seeds[..]];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.escrow.to_account_info(),
                    to: ctx.accounts.sender_token.to_account_info(),
                    authority: ctx.accounts.escrow.to_account_info(),
                },
                signer_seeds,
            ),
            lock.amount,
        )?;

        emit!(RefundedEvent {
            lock_id: lock.lock_id,
        });
        Ok(())
    }

    pub fn send_to_treasury(ctx: Context<SendToTreasury>) -> Result<()> {
        let lock = &mut ctx.accounts.lock_account;
        require!(lock.state == LockState::DataPosted, HtlcError::NotDataPosted);

        let clock = Clock::get()?;
        require!(
            clock.unix_timestamp >= lock.data_deadline,
            HtlcError::DeadlineNotPassed
        );

        lock.state = LockState::Treasury;

        let seeds = &[b"escrow", lock.lock_id.as_ref(), &[lock.bump]];
        let signer_seeds = &[&seeds[..]];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.escrow.to_account_info(),
                    to: ctx.accounts.treasury_token.to_account_info(),
                    authority: ctx.accounts.escrow.to_account_info(),
                },
                signer_seeds,
            ),
            lock.amount,
        )?;

        emit!(SentToTreasuryEvent {
            lock_id: lock.lock_id,
            treasury: ctx.accounts.config.treasury,
        });
        Ok(())
    }
}

pub const CONFIRMATION_WINDOW: i64 = 120;

// --- State ---

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum LockState {
    Empty,
    Locked,
    DataPosted,
    Confirmed,
    Claimed,
    Refunded,
    Treasury,
}

#[account]
pub struct ProgramConfig {
    pub admin: Pubkey,    // 32
    pub treasury: Pubkey, // 32
}

#[account]
pub struct LockAccount {
    pub sender: Pubkey,         // 32
    pub recipient: Pubkey,      // 32
    pub mint: Pubkey,           // 32
    pub amount: u64,            // 8
    pub hashlock: [u8; 32],     // 32
    pub timelock: i64,          // 8
    pub state: LockState,       // 1
    pub lock_id: [u8; 32],      // 32
    pub bump: u8,               // 1
    pub data_deadline: i64,     // 8
    pub data_hash: [u8; 32],    // 32
    pub receipt_hash: [u8; 32], // 32
}

// LockAccount size: 8 (discriminator) + 32 + 32 + 32 + 8 + 32 + 8 + 1 + 32 + 1 + 8 + 32 + 32 = 258

// --- Account Contexts ---

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        init,
        payer = admin,
        space = 8 + 32 + 32,
        seeds = [b"config"],
        bump,
    )]
    pub config: Account<'info, ProgramConfig>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(lock_id: [u8; 32], hashlock: [u8; 32], amount: u64, timelock: i64)]
pub struct LockFunds<'info> {
    #[account(mut)]
    pub sender: Signer<'info>,

    /// CHECK: Recipient is just stored, validated off-chain
    pub recipient: UncheckedAccount<'info>,

    pub token_mint: Account<'info, Mint>,

    #[account(
        init,
        payer = sender,
        space = 8 + 32 + 32 + 32 + 8 + 32 + 8 + 1 + 32 + 1 + 8 + 32 + 32,
        seeds = [b"lock", lock_id.as_ref()],
        bump,
    )]
    pub lock_account: Box<Account<'info, LockAccount>>,

    #[account(
        init,
        payer = sender,
        token::mint = token_mint,
        token::authority = escrow,
        seeds = [b"escrow", lock_id.as_ref()],
        bump,
    )]
    pub escrow: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        constraint = sender_token.owner == sender.key(),
        constraint = sender_token.mint == token_mint.key(),
    )]
    pub sender_token: Box<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct PostDataHash<'info> {
    #[account(mut)]
    pub recipient: Signer<'info>,

    #[account(
        mut,
        seeds = [b"lock", lock_account.lock_id.as_ref()],
        bump,
    )]
    pub lock_account: Account<'info, LockAccount>,
}

#[derive(Accounts)]
pub struct ConfirmReceipt<'info> {
    #[account(mut)]
    pub sender: Signer<'info>,

    #[account(
        mut,
        seeds = [b"lock", lock_account.lock_id.as_ref()],
        bump,
    )]
    pub lock_account: Account<'info, LockAccount>,
}

#[derive(Accounts)]
pub struct ClaimFunds<'info> {
    #[account(mut)]
    pub claimer: Signer<'info>,

    #[account(
        mut,
        seeds = [b"lock", lock_account.lock_id.as_ref()],
        bump,
    )]
    pub lock_account: Account<'info, LockAccount>,

    #[account(
        mut,
        seeds = [b"escrow", lock_account.lock_id.as_ref()],
        bump,
    )]
    pub escrow: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = recipient_token.owner == lock_account.recipient,
        constraint = recipient_token.mint == lock_account.mint,
    )]
    pub recipient_token: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct RefundFunds<'info> {
    #[account(mut)]
    pub refunder: Signer<'info>,

    #[account(
        mut,
        seeds = [b"lock", lock_account.lock_id.as_ref()],
        bump,
    )]
    pub lock_account: Account<'info, LockAccount>,

    #[account(
        mut,
        seeds = [b"escrow", lock_account.lock_id.as_ref()],
        bump,
    )]
    pub escrow: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = sender_token.owner == lock_account.sender,
        constraint = sender_token.mint == lock_account.mint,
    )]
    pub sender_token: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct SendToTreasury<'info> {
    #[account(mut)]
    pub caller: Signer<'info>,

    #[account(
        seeds = [b"config"],
        bump,
    )]
    pub config: Account<'info, ProgramConfig>,

    #[account(
        mut,
        seeds = [b"lock", lock_account.lock_id.as_ref()],
        bump,
    )]
    pub lock_account: Account<'info, LockAccount>,

    #[account(
        mut,
        seeds = [b"escrow", lock_account.lock_id.as_ref()],
        bump,
    )]
    pub escrow: Account<'info, TokenAccount>,

    #[account(
        mut,
        constraint = treasury_token.owner == config.treasury,
        constraint = treasury_token.mint == lock_account.mint,
    )]
    pub treasury_token: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

// --- Errors ---

#[error_code]
pub enum HtlcError {
    #[msg("Lock is not in Locked state")]
    NotLocked,
    #[msg("Lock is not in DataPosted state")]
    NotDataPosted,
    #[msg("Lock is not in Confirmed state")]
    NotConfirmed,
    #[msg("Timelock has expired")]
    Expired,
    #[msg("Timelock has not expired yet")]
    NotExpired,
    #[msg("Data deadline has passed")]
    DeadlinePassed,
    #[msg("Data deadline has not passed yet")]
    DeadlineNotPassed,
    #[msg("Invalid preimage")]
    BadPreimage,
    #[msg("Receipt hash does not match data hash")]
    HashMismatch,
    #[msg("Caller is not the recipient")]
    NotRecipient,
    #[msg("Caller is not the sender")]
    NotSender,
}

// --- Events ---

#[event]
pub struct LockedEvent {
    pub lock_id: [u8; 32],
    pub sender: Pubkey,
    pub recipient: Pubkey,
    pub hashlock: [u8; 32],
    pub amount: u64,
    pub timelock: i64,
}

#[event]
pub struct DataPostedEvent {
    pub lock_id: [u8; 32],
    pub data_hash: [u8; 32],
    pub data_deadline: i64,
}

#[event]
pub struct ReceiptConfirmedEvent {
    pub lock_id: [u8; 32],
    pub receipt_hash: [u8; 32],
}

#[event]
pub struct ClaimedEvent {
    pub lock_id: [u8; 32],
    pub preimage: [u8; 32],
}

#[event]
pub struct RefundedEvent {
    pub lock_id: [u8; 32],
}

#[event]
pub struct SentToTreasuryEvent {
    pub lock_id: [u8; 32],
    pub treasury: Pubkey,
}
