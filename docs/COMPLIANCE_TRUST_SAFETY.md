# Compliance, Legal, Tax & Trust/Safety — U.S. Marketplace Checklist

## 1. Compliance Checklist by Domain

### 1.1 Payments & Financial

| # | Requirement | Standard/Law | Status | Owner |
|---|-------------|-------------|--------|-------|
| F1 | PCI DSS compliance (SAQ-A via Stripe.js) | PCI DSS v4.0 | ✅ Stripe handles card data | Engineering |
| F2 | No storage of raw card numbers, CVVs, or PANs | PCI DSS | ✅ Architecture enforced | Engineering |
| F3 | Stripe Connect onboarding handles vendor KYC/KYB | FinCEN / BSA | ✅ Delegated to Stripe | Product |
| F4 | Platform registered as Money Services Business (MSB) exemption review | FinCEN | ⬜ Legal review needed | Legal |
| F5 | State money transmitter license assessment | State laws | ⬜ Legal review (Stripe facilitator model may exempt) | Legal |
| F6 | Annual 1099-K reporting for vendors ≥ $600/year | IRS §6050W (post-2024) | ⬜ Implement | Finance |
| F7 | Collect vendor W-9 (TIN/SSN) before first payout or at $600 threshold | IRS | ⬜ Integrate via Stripe Connect tax reporting | Finance |
| F8 | Platform fee disclosed before payment | CFPB transparency | ✅ Fee breakdown in UI | Product |
| F9 | Refund policy clearly stated | FTC | ⬜ Legal page needed | Legal |
| F10 | No unfair/deceptive billing practices | FTC Act §5 | ✅ Clear pricing | Product |

### 1.2 Privacy & Data Protection

| # | Requirement | Standard/Law | Status | Owner |
|---|-------------|-------------|--------|-------|
| P1 | Privacy Policy published and accessible | CCPA, state laws | ⬜ Draft needed | Legal |
| P2 | Cookie consent banner (if using analytics cookies) | CCPA, state laws | ⬜ Implement | Engineering |
| P3 | Right to know (data access request) | CCPA §1798.100 | ⬜ Build data export endpoint | Engineering |
| P4 | Right to delete (account + PII deletion) | CCPA §1798.105 | ✅ GDPR delete in admin | Engineering |
| P5 | Right to opt-out of sale/sharing | CCPA §1798.120 | ⬜ "Do Not Sell" link | Engineering |
| P6 | Data breach notification within 72h | State breach laws (CA, NY, etc.) | ⬜ Incident response plan | Security |
| P7 | Minimum data collection principle | Privacy best practice | ✅ Only required fields | Product |
| P8 | Children's data: no users under 18 | COPPA (under 13); platform policy (under 18) | ⬜ Age gate at registration | Engineering |
| P9 | Geolocation data: disclose collection and use | CCPA, FTC | ⬜ Add to Privacy Policy | Legal |
| P10 | Vendor address not exposed until assignment | Platform design | ✅ Pin jitter implemented | Engineering |
| P11 | PII encrypted at rest | Best practice | ✅ Aurora TDE + S3 SSE | Engineering |
| P12 | PII scrubbed from logs | Best practice | ✅ Serilog destructuring | Engineering |

### 1.3 Employment & Labor

| # | Requirement | Standard/Law | Status | Owner |
|---|-------------|-------------|--------|-------|
| L1 | Vendors classified as independent contractors | IRS 20-factor test, ABC test (CA AB5) | ⬜ Legal review; document control factors | Legal |
| L2 | No control over when/how vendor performs work | IC classification | ✅ Architecture: vendor self-selects jobs | Product |
| L3 | Vendors set own availability and service radius | IC classification | ✅ Profile-based | Product |
| L4 | Platform does not provide tools/equipment | IC classification | ✅ Vendors use own equipment | Product |
| L5 | Vendor agreement explicitly states IC relationship | Contract law | ⬜ Draft Vendor Agreement | Legal |
| L6 | No exclusivity requirement | IC classification | ✅ Platform allows multi-homing | Product |
| L7 | California AB5 / Prop 22 analysis | CA Labor Code | ⬜ Legal assessment needed | Legal |

### 1.4 Consumer Protection

| # | Requirement | Standard/Law | Status | Owner |
|---|-------------|-------------|--------|-------|
| C1 | Terms of Service published | Contract law | ⬜ Draft needed | Legal |
| C2 | Clear cancellation and refund terms | FTC, state consumer laws | ⬜ Part of ToS | Legal |
| C3 | No bait-and-switch pricing | FTC Act §5 | ✅ Budget set by customer | Product |
| C4 | Dispute resolution mechanism available | FTC, state laws | ✅ In-app dispute system | Product |
| C5 | Mandatory arbitration clause (if used) requires clear disclosure | FAA, state laws | ⬜ Legal decision | Legal |
| C6 | Electronic Signatures Act compliance (E-SIGN) | 15 U.S.C. §7001 | ⬜ Consent checkboxes qualify | Engineering |

### 1.5 Accessibility

| # | Requirement | Standard/Law | Status | Owner |
|---|-------------|-------------|--------|-------|
| A1 | WCAG 2.1 AA compliance for web interface | ADA Title III (case law) | ⬜ Audit needed | Engineering |
| A2 | Keyboard-accessible alternative to map | WCAG 2.1 | ✅ List view fallback spec'd | Engineering |
| A3 | Screen reader support for job cards | WCAG 2.1 | ⬜ ARIA labels needed | Engineering |
| A4 | Color not sole indicator of status | WCAG 2.1 | ✅ Icons + color | Design |

---

## 2. Data Governance Requirements

### 2.1 Data Classification

| Classification | Description | Examples | Controls |
|---------------|-------------|----------|----------|
| **Restricted** | Sensitive PII; financial | SSN/TIN, bank accounts, passwords | Encrypted at rest + transit; access-logged; min retention |
| **Confidential** | Business PII | Email, phone, address, job details | Encrypted at rest; role-based access |
| **Internal** | Operational data | Audit logs, metrics, job categories | Standard access controls |
| **Public** | Published content | Vendor business name, avg rating | No restrictions |

### 2.2 Data Retention Schedule

| Data Category | Retention Period | Justification | Deletion Method |
|--------------|-----------------|---------------|-----------------|
| Active user account data | Until account deletion request | Operational | Anonymization |
| Payment transactions & ledger | 7 years from transaction date | IRS record-keeping (§6001) | Archive then purge |
| 1099-K reporting data | 7 years | IRS requirement | Archive |
| Vendor W-9 / TIN data | 4 years after last 1099 filed | IRS §6107 | Secure delete |
| Job request records | 7 years | Tax/legal support | Archive |
| Dispute records | 7 years | Legal liability | Archive |
| Audit log entries | 5 years | Compliance forensics | Archive |
| Notification records | 90 days | UX only | Hard delete |
| Session/auth tokens | 30 days max | Security | Auto-expire |
| Deleted account PII | 30-day grace period | Accidental deletion recovery | Hard purge |
| Photos/documents | 1 year after job closure | Dispute evidence | Soft delete → purge |

### 2.3 Data Subject Rights Workflow

```
User submits request via:
  - In-app settings → "Download my data" / "Delete my account"
  - Email to privacy@Rakr.com

┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Request │───▶│ Verify   │───▶│ Process  │───▶│ Confirm  │
│  (User)  │    │ Identity │    │ (30 days)│    │ Complete │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
```

**Timelines:**
- Acknowledge request: 10 business days
- Fulfill request: 45 calendar days (CCPA allows 45 + 45 extension)
- Deletion: 30-day grace period then hard purge

### 2.4 Data Processing Inventory

| Processing Activity | Legal Basis | Data Subjects | Recipients |
|--------------------|-------------|---------------|------------|
| Account registration | Consent + Contract | Users | Internal only |
| Job matching (geolocation) | Legitimate interest | Vendors | Map display (aggregated) |
| Payment processing | Contract performance | Customers, Vendors | Stripe |
| Email notifications | Consent (opt-in) | Users | SendGrid/SES |
| Fraud detection | Legitimate interest | Users | Internal |
| Tax reporting (1099-K) | Legal obligation | Vendors | IRS |
| Analytics (aggregated) | Legitimate interest | Users | Internal dashboards |

---

## 3. Vendor Verification & Risk Controls

### 3.1 Vendor Onboarding Verification Matrix

| Check | When | Method | Blocking? | Provider |
|-------|------|--------|-----------|----------|
| Email verification | Registration | Confirmation link | ✅ Yes | Internal |
| Identity verification (KYC) | First payout setup | Stripe Connect onboarding | ✅ Yes | Stripe Identity |
| Business verification (KYB) | If business entity | Stripe Connect | ✅ Yes | Stripe |
| Insurance documentation | Profile completion | Manual upload + admin review | ✅ Yes (configurable) | Admin |
| Bank account verification | Payout setup | Stripe micro-deposits or instant | ✅ Yes | Stripe |
| Phone verification | Optional at MVP | SMS OTP | ❌ No | Twilio (future) |
| Background check | Post-MVP | Third-party API | ❌ No (future) | Checkr (future) |
| Service area validation | Profile | Self-declared + GPS correlation | ❌ No | Internal |

### 3.2 Vendor Risk Scoring

| Signal | Weight | Threshold | Action |
|--------|--------|-----------|--------|
| Average rating < 3.0 | High | < 3.0 after 10+ jobs | Warning → suspension |
| Dispute rate > 15% | High | > 15% of jobs disputed | Auto-suspend; admin review |
| Cancellation rate > 25% | Medium | > 25% vendor-initiated cancels | Warning notification |
| No-show rate > 10% | High | > 10% assigned but never started | Suspension |
| Multiple customer complaints | High | 3+ complaints in 30 days | Admin review queue |
| Account age < 7 days + high activity | Medium | Unusual pattern | Flag for review |
| Payment payout failures | Low | 3+ consecutive failures | Restrict new jobs until resolved |

### 3.3 Vendor Tier System (Trust Levels)

| Tier | Requirements | Benefits | Restrictions |
|------|-------------|----------|--------------|
| **New** | Just verified | Can request up to 3 concurrent jobs | ✅ All reviews manual |
| **Established** | 10+ jobs, rating ≥ 4.0, 30+ days | Up to 10 concurrent jobs | Some auto-accept eligible |
| **Preferred** | 50+ jobs, rating ≥ 4.5, 90+ days, 0 disputes | Unlimited concurrent; priority in results | Badge displayed to customers |

---

## 4. Fraud & Abuse Prevention Controls

### 4.1 Fraud Scenarios & Mitigations

| Scenario | Detection | Prevention | Response |
|----------|-----------|-----------|----------|
| **Fake job posting** (phishing) | NLP content analysis; URL detection | Block URLs in descriptions; CAPTCHA on rapid posting | Auto-hide + admin review |
| **Sybil accounts** (fake reviews) | Device fingerprinting; email domain analysis | Limit accounts per device/IP; verified-only ratings | Suspend all linked accounts |
| **Payment fraud** (stolen cards) | Stripe Radar ML; velocity checks | 3D Secure for new cards; address verification | Refund + ban |
| **Vendor no-show farming** | Pattern: accept then cancel repeatedly | Cancellation rate tracking; progressive penalties | Auto-suspend after 3 no-shows |
| **Collusion** (fake jobs for self-payout) | Same IP/device for customer + vendor; address matching | Block self-request; flag same-household patterns | Admin investigation |
| **Rate manipulation** (fake ratings) | Rating from accounts with no real jobs | Only allow ratings on completed/paid jobs | Delete fake ratings; suspend accounts |
| **Account takeover** | Login from new device/location; credential stuffing | MFA; device tracking; rate-limit login attempts | Force password reset; notify user |
| **Service area abuse** (distant jobs) | Vendor requests job far outside radius | Enforce service radius server-side | Reject request with error |
| **Budget manipulation** (absurdly low/high) | Budget < $5 or > $10,000 | Server-side validation; flag outliers | Block or require admin approval |

### 4.2 Automated Fraud Rules

```csharp
public class FraudRuleEngine
{
    // Rule 1: Rapid job creation (> 10 jobs in 1 hour)
    // Rule 2: Same customer + vendor address
    // Rule 3: New account + high-value job (> $500) + immediate payment
    // Rule 4: Multiple failed payment attempts (> 3 in 24h)
    // Rule 5: Vendor accepts and completes job in < 5 minutes
    // Rule 6: Customer confirms payment within 1 minute of completion
}
```

### 4.3 Abuse Reporting System

**User-facing report flow:**
```
User → "Report" button (on profile, job, or review)
      → Select reason category
      → Optional description
      → Submit
      → Confirmation: "Report received. We'll review within 24h."
```

**Report categories:**
- Spam / fake listing
- Inappropriate content
- Harassment / threatening behavior
- Fraud / scam
- No-show / didn't complete work
- Unsafe behavior
- Other

**API:** `POST /api/reports`
```json
{
  "entityType": "User|JobRequest|Rating|VendorProfile",
  "entityId": "uuid",
  "reason": "fraud",
  "description": "This vendor never showed up but marked the job complete.",
  "evidence": ["screenshot_url_1"]
}
```

### 4.4 Content Moderation

| Content Type | Moderation | Method |
|-------------|-----------|--------|
| Job titles/descriptions | Pre-publish filter | Keyword blocklist + regex |
| Profile bios | Post-publish review | Async moderation queue |
| Photos | Pre-display scan | AWS Rekognition (nudity/violence detection) |
| Reviews/ratings | Post-publish | Report-triggered review |
| Messages (future) | Real-time filter | Keyword detection |

**Blocked content patterns:**
- Phone numbers / emails in job descriptions (prevent off-platform)
- External URLs
- Profanity / hate speech (blocklist)
- Duplicate/spammy content (fuzzy matching)

---

## 5. Tax Considerations (1099-K)

### 5.1 IRS Reporting Requirements (Post-2024)

**Threshold:** $600 gross payments per vendor per calendar year (down from $20,000/200 transactions).

**Platform obligation:**
1. Collect W-9 (TIN + legal name) from vendors.
2. Report gross payments on Form 1099-K to IRS and vendor.
3. File by January 31 of following year.
4. Backup withhold 24% if vendor doesn't provide valid TIN.

### 5.2 Implementation Plan

| Step | Timing | Action |
|------|--------|--------|
| 1 | Vendor onboarding | Collect legal name, TIN via Stripe Connect tax interview |
| 2 | Approaching $600 | Notify vendor: "You're approaching 1099-K threshold" |
| 3 | At $600+ | Ensure W-9 on file; if not, hold future payouts |
| 4 | Year-end | Generate 1099-K forms via Stripe Tax Reporting API |
| 5 | Jan 31 | File with IRS; deliver to vendors (electronic or mail) |
| 6 | Corrections | Handle W-9 corrections and amended filings |

### 5.3 Stripe Tax Reporting Integration

Stripe Connect handles most 1099-K obligations when configured:
- Collects tax information during Express onboarding.
- Tracks gross volume per connected account.
- Generates and files 1099-K forms.
- Delivers electronic copies to connected accounts.
- Platform reviews and approves before filing.

**Configuration:** Enable "Tax reporting" in Stripe Connect settings.

### 5.4 Sales Tax Considerations

- Rakr is a **marketplace facilitator** in most states.
- Yard work services may be subject to sales tax in some states (varies by state).
- **MVP approach:** Do not collect sales tax; clearly state prices exclude tax.
- **Post-MVP:** Integrate Stripe Tax or TaxJar for automated sales tax calculation.
- Marketplace facilitator laws may require the platform to collect/remit in some states.

---

## 6. Required Legal Pages & Consent Records

### 6.1 Required Legal Documents

| Document | URL | Last Updated | Review Cadence |
|----------|-----|-------------|----------------|
| Terms of Service | `/legal/terms` | At launch | Annually + material changes |
| Privacy Policy | `/legal/privacy` | At launch | Annually |
| Cookie Policy | `/legal/cookies` | At launch | Annually |
| Vendor Agreement (IC Terms) | `/legal/vendor-agreement` | At launch | Annually |
| Acceptable Use Policy | `/legal/acceptable-use` | At launch | Annually |
| Community Guidelines | `/legal/community` | At launch | Semi-annually |
| Refund & Cancellation Policy | `/legal/refunds` | At launch | Annually |
| DMCA / Copyright Policy | `/legal/copyright` | At launch | As needed |
| CCPA Notice at Collection | `/legal/ccpa-notice` | At launch | Annually |
| Dispute Resolution / Arbitration | Part of ToS | At launch | Annually |

### 6.2 Consent Records

Every legally significant user action must be recorded immutably:

```csharp
public class ConsentRecord
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string ConsentType { get; set; }    // See table below
    public string Version { get; set; }        // "v1.0", "v2.1"
    public bool Granted { get; set; }
    public DateTime ConsentedAt { get; set; }
    public DateTime? RevokedAt { get; set; }
    public string? IpAddress { get; set; }
    public string? UserAgent { get; set; }
    public string? DocumentHash { get; set; }  // SHA-256 of document version
}
```

| Consent Type | When Collected | Required? | Revocable? |
|-------------|---------------|-----------|-----------|
| `terms_of_service` | Registration | ✅ Must accept | ❌ (account deletion instead) |
| `privacy_policy` | Registration | ✅ Must accept | ❌ (account deletion instead) |
| `vendor_agreement` | Vendor profile creation | ✅ For vendors | ❌ |
| `marketing_email` | Registration (opt-in) | ❌ Optional | ✅ Unsubscribe anytime |
| `push_notifications` | First push prompt | ❌ Optional | ✅ Device settings |
| `geolocation_collection` | First map use | ✅ For map feature | ✅ Revoke in settings |
| `cookie_analytics` | First visit | ❌ Optional | ✅ Cookie settings |
| `data_processing` | Registration | ✅ Must accept | ❌ (account deletion) |
| `arbitration_agreement` | Registration (if applicable) | ✅ If in ToS | ❌ (30-day opt-out window) |

### 6.3 Consent Version Management

When legal documents change:
1. Increment version number.
2. Existing users shown "Updated terms" banner on next login.
3. Users must re-accept before continuing.
4. New consent record created with new version.
5. Old consent record retained (never deleted).

### 6.4 CCPA-Specific Requirements

| Requirement | Implementation |
|-------------|---------------|
| "Do Not Sell My Personal Information" link | Footer link on every page |
| Notice at Collection | `/legal/ccpa-notice` listing data categories, purposes, retention |
| Opt-out mechanism | `POST /api/privacy/opt-out` + cookie `ccpa_optout=1` |
| Authorized agent requests | Email verification + power of attorney |
| Non-discrimination | Same service regardless of privacy choices |
| Financial incentive disclosure | If loyalty program exists (N/A at MVP) |

---

## 7. Trust & Safety Operations

### 7.1 Trust & Safety Team Responsibilities

| Function | SLA | Escalation |
|----------|-----|-----------|
| User reports review | 24h first response | Admin → Legal if criminal |
| Dispute mediation | 48h first contact | Support → Admin → Owner |
| Fraud investigation | 4h for payment fraud | Auto-suspend → Admin review |
| Content takedown | 24h (72h if complex) | Auto-hide → Admin review |
| Law enforcement requests | Per legal counsel | Legal team only |
| Safety incidents | Immediate if physical danger | Call 911; then platform action |

### 7.2 Escalation Matrix

```
                    ┌──────────┐
              ┌────▶│  Legal   │◀─── Law enforcement, subpoenas
              │     └──────────┘
              │
┌──────────┐  │  ┌──────────┐
│  Report  │──┼─▶│  Admin   │◀─── Fraud, suspension, complex disputes
│  (User)  │  │  └──────────┘
└──────────┘  │        ▲
              │        │ Escalate
              │  ┌──────────┐
              └─▶│ Support  │◀─── First-line: simple disputes, notes
                 └──────────┘
```

### 7.3 Safety Commitments

| Commitment | Implementation |
|-----------|---------------|
| No tolerance for threats/violence | Immediate permanent ban; report to law enforcement |
| Discrimination prohibited | Community guidelines; training; bias monitoring |
| Physical safety resources | Emergency contact info accessible in-app |
| Vendor safety (property access) | Customer agrees to safe working conditions |
| Dispute resolution fairness | Both sides heard; evidence required |

---

## 8. Insurance & Liability

### 8.1 Platform Insurance Needs

| Coverage | Purpose | Estimated Cost |
|----------|---------|----------------|
| General liability | Third-party claims | $1,000-2,000/yr |
| Errors & Omissions (E&O) | Platform malfunction claims | $2,000-5,000/yr |
| Cyber liability | Data breach costs | $1,500-3,000/yr |
| Directors & Officers (D&O) | Management liability | $2,000-5,000/yr |

### 8.2 Vendor Insurance Requirements

| Requirement | Policy | MVP Enforcement |
|-------------|--------|-----------------|
| General liability (recommended) | $1M per occurrence | ⬜ Optional (flag if missing) |
| Workers' compensation | State-required if employees | ❌ ICs don't need |
| Auto insurance | If using vehicle for work | ❌ Not platform's scope |

### 8.3 Liability Limitations

In Terms of Service:
- Platform is a marketplace, not employer or service provider.
- Platform not liable for vendor work quality.
- Platform not liable for property damage (vendor's insurance).
- Dispute resolution via platform; binding arbitration for claims > $500.
- Limitation of liability: platform fees paid in prior 12 months.

---

## 9. Implementation Priority

### Phase 1 (Pre-Launch — Must Have)

- [ ] Terms of Service (drafted by legal counsel)
- [ ] Privacy Policy (CCPA-compliant)
- [ ] Vendor Independent Contractor Agreement
- [ ] Consent record system
- [ ] Age verification (18+ check at registration)
- [ ] Abuse reporting endpoint
- [ ] Content blocklist filters
- [ ] Stripe Connect tax reporting enabled
- [ ] CCPA "Do Not Sell" link
- [ ] Basic fraud rules (rapid creation, self-dealing)

### Phase 2 (Month 1-3 Post-Launch)

- [ ] Full accessibility audit (WCAG 2.1 AA)
- [ ] Vendor risk scoring system
- [ ] Automated 1099-K tracking and notifications
- [ ] Cookie consent management platform
- [ ] Data export (right to know) endpoint
- [ ] Enhanced fraud detection rules
- [ ] Community guidelines publication

### Phase 3 (Month 3-6)

- [ ] Background check integration (Checkr)
- [ ] Photo content moderation (AWS Rekognition)
- [ ] Sales tax assessment and integration
- [ ] Annual legal document review process
- [ ] Third-party security audit / pen test
- [ ] Vendor tier system implementation
