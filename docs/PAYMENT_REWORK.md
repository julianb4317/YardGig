# Payment Rework — Platform-Held Funds with Weekly Vendor Payouts

## New Model Summary

**Before:** Stripe Connect destination charges (money flows directly from customer → vendor with platform fee skimmed).

**After:** Platform-custodied payments. Customer pays the platform. Platform holds funds. Vendor accumulates a balance. Weekly batch payout from platform's bank to vendor's bank.

```
┌──────────┐       ┌─────────────────────┐       ┌──────────┐
│ Customer │──$──▶ │  YardGig Platform   │──$──▶ │  Vendor  │
│ (card)   │       │  (Stripe Account)   │       │  (bank)  │
└──────────┘       │                     │       └──────────┘
                   │  Holds funds until   │
                   │  weekly payout       │
                   │                     │
                   │  Platform fee kept   │
                   │  in same account     │
                   └─────────────────────┘
                          │
                   Weekly ACH batch payout
```

---

## How It Works (Stripe Implementation)

### Option A: Stripe with Separate Charges and Transfers (Recommended)

1. **Platform has its own Stripe account** — receives all customer payments.
2. **Vendors are Connected Accounts** (Express) — but only for payout identity verification and bank account collection.
3. **Customer pays platform** — standard PaymentIntent charged to customer's card, funds land in platform's Stripe balance.
4. **Vendor balance tracked in our DB** — `VendorBalance` entity tracks what's owed.
5. **Weekly payout job** — background worker creates `Transfer` objects from platform balance to each vendor's connected account on a fixed schedule.

**Why this works:**
- Stripe still handles KYC/bank verification for vendors via Connected Accounts.
- Platform has full control over payout timing.
- Platform's Stripe balance acts as the "holding tank."
- No separate admin bank account needed — Stripe IS the holding tank.
- Stripe automatically deposits to the platform's own bank account on its own schedule (separate from vendor payouts).

### Option B: Standard Stripe (No Connect)

Platform charges customers with standard Stripe. Vendors add bank accounts through a custom UI (Plaid or manual). Platform uses Stripe Payouts or external ACH to send money.

**Drawback:** Platform must handle vendor identity verification, tax reporting, and banking integrations manually. Much more compliance burden.

**Recommendation: Option A** — leverage Stripe Connect for vendor identity/bank but control the timing ourselves.

---

## Flow Diagrams

### Customer Payment (On Job Completion)

```
1. Vendor marks job "Completed"
2. Customer clicks "Confirm & Pay"
3. Frontend → POST /api/payments/charge { jobId }
4. Backend:
   a. Create PaymentIntent (platform's Stripe, no transfer_data)
   b. Charge customer's saved card
   c. On success:
      - PaymentTransaction(status=Captured)
      - VendorBalance += (jobBudget - platformFee)
      - LedgerEntry: customer_charge, platform_fee, vendor_earned
      - Job status → Paid
5. Money sits in platform's Stripe balance
```

### Weekly Payout (Background Job — e.g., every Monday at 06:00 UTC)

```
1. Query all vendors where VendorBalance.availableBalance > $1
2. For each vendor:
   a. Create Stripe Transfer (platform → vendor connected account)
   b. If success: VendorBalance.availableBalance -= payout amount
   c. Create PayoutRecord(status=Initiated)
   d. LedgerEntry: vendor_payout
3. Stripe automatically deposits to vendor's bank (T+2)
4. Webhook: transfer.paid → PayoutRecord(status=Paid)
```

### Vendor Onboarding (Bank Account)

```
1. Vendor signs up → must complete Stripe Express onboarding
2. Stripe collects: legal name, SSN/EIN, bank account, address
3. Webhook: account.updated (payouts_enabled=true)
4. Vendor can now receive payouts
5. Until onboarding complete: vendor can work but payouts accumulate
```

### Customer Onboarding (Card)

```
1. Customer signs up → prompted to add payment method
2. Frontend uses Stripe Elements (SetupIntent) to collect card
3. Card saved as Stripe PaymentMethod attached to Customer
4. On job payment: use saved card (no re-entry needed)
```

---

## Data Model Changes

### New Entity: VendorBalance

```csharp
public class VendorBalance
{
    public Guid Id { get; set; }
    public Guid VendorProfileId { get; set; }
    public int AvailableBalanceCents { get; set; }  // Ready for payout
    public int PendingBalanceCents { get; set; }    // Held during dispute period (optional)
    public int LifetimeEarnedCents { get; set; }    // Running total
    public DateTime LastPayoutAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    
    public VendorProfile VendorProfile { get; set; } = null!;
}
```

### Updated: PaymentTransaction

```csharp
// Remove: VendorPayoutCents (payout is separate now)
// Add: StripeCustomerId reference
public class PaymentTransaction
{
    public Guid Id { get; set; }
    public Guid JobRequestId { get; set; }
    public string? StripePaymentIntentId { get; set; }
    public string? StripeCustomerId { get; set; }  // Customer who was charged
    public int AmountCents { get; set; }           // What customer paid
    public int PlatformFeeCents { get; set; }      // Platform keeps
    public int VendorEarnedCents { get; set; }     // Added to vendor balance
    public string Currency { get; set; } = "usd";
    public PaymentStatus Status { get; set; }
    public DateTime? CapturedAt { get; set; }
    public DateTime CreatedAt { get; set; }
}
```

### Updated: Payout (Weekly batch payout to vendor)

```csharp
public class Payout
{
    public Guid Id { get; set; }
    public Guid VendorProfileId { get; set; }
    public string? StripeTransferId { get; set; }
    public int AmountCents { get; set; }
    public PayoutStatus Status { get; set; }       // Pending, Initiated, Paid, Failed
    public string? FailureReason { get; set; }
    public DateTime? PaidAt { get; set; }
    public DateTime CreatedAt { get; set; }
    // No longer linked to a single PaymentTransaction — covers accumulated balance
}
```

### New: CustomerPaymentMethod (reference to saved Stripe card)

```csharp
public class CustomerPaymentMethod
{
    public Guid Id { get; set; }
    public Guid CustomerProfileId { get; set; }
    public string StripePaymentMethodId { get; set; }  // pm_xxx
    public string StripeCustomerId { get; set; }       // cus_xxx
    public string CardLast4 { get; set; }
    public string CardBrand { get; set; }              // visa, mastercard
    public int ExpMonth { get; set; }
    public int ExpYear { get; set; }
    public bool IsDefault { get; set; }
    public DateTime CreatedAt { get; set; }
}
```

---

## API Changes

### Remove/Deprecate
- ~~`POST /api/payments/initiate` (clientSecret flow)~~ → Replace with saved-card charge
- ~~`POST /api/vendors/stripe/onboard`~~ → Keep (still needed for bank/identity)

### New Endpoints

| Method | Endpoint | Actor | Description |
|--------|----------|-------|-------------|
| POST | `/api/payments/setup-intent` | Customer | Create Stripe SetupIntent to save card |
| POST | `/api/payments/charge` | Customer | Charge saved card for a completed job |
| GET | `/api/payments/methods` | Customer | List saved payment methods |
| DELETE | `/api/payments/methods/{id}` | Customer | Remove a saved card |
| GET | `/api/vendor/balance` | Vendor | View current balance + payout history |
| GET | `/api/vendor/payouts` | Vendor | List past payouts |
| POST | `/api/admin/payouts/run` | Admin | Manually trigger weekly payout |

### Modified Endpoints
| Method | Endpoint | Change |
|--------|----------|--------|
| POST | `/api/vendors/stripe/onboard` | Same — still needed for bank account verification |
| GET | `/api/vendors/stripe/status` | Same — check if payouts_enabled |

---

## Weekly Payout Background Job

```csharp
// Runs every Monday at 06:00 UTC via hosted service or Hangfire
public class WeeklyPayoutJob
{
    public async Task ExecuteAsync()
    {
        var vendors = await db.VendorBalances
            .Include(vb => vb.VendorProfile)
            .Where(vb => vb.AvailableBalanceCents > 100) // Min $1 payout
            .ToListAsync();

        foreach (var vendor in vendors)
        {
            if (string.IsNullOrEmpty(vendor.VendorProfile.StripeAccountId))
                continue; // Can't pay — no bank on file

            var transferId = await stripe.CreateTransferAsync(
                vendor.VendorProfile.StripeAccountId,
                vendor.AvailableBalanceCents,
                "usd",
                idempotencyKey: $"payout_{vendor.VendorProfileId}_{DateTime.UtcNow:yyyyMMdd}");

            vendor.AvailableBalanceCents = 0;
            vendor.LastPayoutAt = DateTime.UtcNow;

            db.Payouts.Add(new Payout {
                VendorProfileId = vendor.VendorProfileId,
                StripeTransferId = transferId,
                AmountCents = vendor.AvailableBalanceCents,
                Status = PayoutStatus.Initiated
            });
        }

        await db.SaveChangesAsync();
    }
}
```

---

## Customer Card Setup Flow

```
1. Customer registers
2. Frontend shows "Add payment method" prompt (blocking before first job payment)
3. POST /api/payments/setup-intent → returns { clientSecret }
4. Frontend: Stripe Elements collects card using clientSecret
5. stripe.confirmSetupIntent(clientSecret) → card saved to Stripe Customer
6. Backend webhook (setup_intent.succeeded): save PaymentMethod reference in DB
7. Future payments use this saved card automatically (no re-entry)
```

---

## Vendor Bank Setup Flow

```
1. Vendor registers  
2. Frontend shows "Set up payouts" prompt
3. POST /api/vendors/stripe/onboard → returns { onboardingUrl }
4. Vendor redirects to Stripe-hosted form (collects bank, identity, tax info)
5. On return: GET /api/vendors/stripe/status → { payoutsEnabled: true }
6. Vendor's balance will be paid out weekly
```

---

## Key Differences from Previous Model

| Aspect | Before (Direct) | After (Platform-Held) |
|--------|----------------|----------------------|
| Money flow | Customer → Vendor (via Stripe Connect) | Customer → Platform → Vendor (weekly) |
| Payout timing | Instant on capture | Weekly batch (Monday) |
| Platform account | Pass-through (application fee) | Holds all funds |
| Vendor Stripe type | Express (receives transfers) | Express (receives weekly transfers) |
| Customer card | Entered at payment time | Saved during registration |
| Refund control | Platform can refund from vendor's balance | Platform refunds from own balance (simpler) |
| Dispute handling | Must reverse vendor transfer | No vendor transfer yet — just reduce balance |
| Platform's bank | Only receives fee | Receives ALL payments; sends payouts |

---

## Advantages of This Model

1. **Simpler refunds** — money hasn't left the platform yet, so refunds come from platform balance.
2. **Dispute control** — can freeze vendor balance without clawing back transfers.
3. **Cash flow visibility** — platform always knows exactly how much is owed.
4. **Fraud protection** — delay between job completion and payout gives time to detect issues.
5. **Simpler Stripe setup** — no destination charges; standard charges + manual transfers.
6. **Batch efficiency** — one payout run per week vs. per-job transfers.

---

## Risks / Considerations

| Risk | Mitigation |
|------|-----------|
| Platform must be registered as money transmitter? | Stripe Connect "Separate charges and transfers" model handles this — Stripe is the regulated entity |
| Vendor dissatisfaction with weekly payouts | Communicate clearly during onboarding; consider offering "instant payout" (for a fee) as premium feature |
| Platform balance insufficient for payouts | Should never happen — platform receives before paying out. Monitor via reconciliation. |
| What if vendor's bank rejects transfer? | Retry 3x; if persistent, hold balance and notify vendor to update bank info |
| Tax reporting (1099-K) | Still handled by Stripe Connect — they track gross volume per connected account |

---

## Migration Plan

This is a significant payment architecture change. Implement as a clean replacement:

1. Add new entities (VendorBalance, CustomerPaymentMethod)
2. New payment service methods (charge saved card, batch transfer)
3. New API endpoints (setup-intent, charge, balance, methods)
4. Weekly payout background job
5. Update frontend payment flow (save card at registration, one-click confirm on job)
6. Deprecate old `POST /api/payments/initiate` (remove after migration)
7. Update PAYMENT_SPEC.md with new flows
