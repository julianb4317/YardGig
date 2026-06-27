# Incremental Implementation Plan — Sprint-by-Sprint Delivery

## Overview

- **Sprint Duration:** 2 weeks
- **Team Size Assumption:** 2 backend, 1 frontend, 1 full-stack
- **Total Sprints:** 8 (16 weeks to MVP launch)
- **Methodology:** Scrum with CI/CD; each sprint produces a deployable increment

---

## Sprint 1: Foundation & Authentication (Weeks 1-2)

### Goal
Working API with Identity-based auth, JWT issuance, Google OAuth, and basic user/vendor profiles.

### Deliverables

| # | File / Feature | Status |
|---|---------------|--------|
| 1 | Solution structure (Domain, Application, Infrastructure, Api) | ✅ Done |
| 2 | `docker-compose.yml` (PostgreSQL + PostGIS, Redis) | ✅ Done |
| 3 | Domain entities: ApplicationUser, Role, UserRole, CustomerProfile, VendorProfile | ✅ Done |
| 4 | EF Core DbContext + PostGIS configuration | ✅ Done |
| 5 | ASP.NET Core Identity (AppIdentityUser, AppIdentityDbContext) | ✅ Done |
| 6 | JWT token generation (15 min access + refresh token) | ✅ Done |
| 7 | Google OAuth integration | ✅ Done |
| 8 | Registration with role selection (Customer/Vendor/Both) | ✅ Done |
| 9 | Email confirmation flow | ✅ Done |
| 10 | MFA/TOTP setup and verification | ✅ Done |
| 11 | Password reset flow | ✅ Done |
| 12 | Authorization policies (CustomerOnly, VendorOnly, AdminOnly, etc.) | ✅ Done |
| 13 | Rate limiting middleware (auth + global) | ✅ Done |
| 14 | Security headers middleware | ✅ Done |
| 15 | Health check endpoint (`/health`) | ✅ Done |
| 16 | Serilog structured logging | ✅ Done |
| 17 | Initial EF migration | ✅ Done |

### Tests Required
- [ ] `AuthController_Register_ValidInput_ReturnsUserId`
- [ ] `AuthController_Register_DuplicateEmail_Returns400`
- [ ] `AuthController_Register_WeakPassword_Returns400`
- [ ] `AuthController_Register_AdminRole_Rejected`
- [ ] `AuthController_Login_ValidCredentials_ReturnsJwt`
- [ ] `AuthController_Login_WrongPassword_Returns401`
- [ ] `AuthController_Login_LockedAccount_Returns401`
- [ ] `AuthController_Login_UnverifiedEmail_RequiresVerification`
- [ ] `AuthController_GoogleLogin_NewUser_CreatesAccount`
- [ ] `AuthController_MfaSetup_ReturnsSharedKey`
- [ ] `Authorization_CustomerEndpoint_VendorDenied`
- [ ] `Authorization_AdminEndpoint_CustomerDenied`
- [ ] `RateLimiting_ExceedsLimit_Returns429`

### Definition of Done
- [x] All auth endpoints return correct responses
- [x] JWT claims include sub, email, roles, email_verified, mfa_enabled
- [x] Lockout works after 5 failed attempts
- [x] Build passes with 0 errors
- [ ] 13 auth tests passing
- [ ] Swagger UI shows all endpoints
- [ ] Docker compose up → API starts and connects to Postgres

---

## Sprint 2: Job CRUD & Geospatial Foundation (Weeks 3-4)

### Goal
Customers can create jobs with geocoded addresses; jobs are queryable by geographic bounds.

### Deliverables

| # | File / Feature | Status |
|---|---------------|--------|
| 1 | Domain: JobRequest entity with PostGIS Point | ✅ Done |
| 2 | Domain: JobStatus enum (full lifecycle) | ✅ Done |
| 3 | Application: CreateJobCommand + Handler + Validator | ✅ Done |
| 4 | Application: GetNearbyJobsQuery (radius-based) | ✅ Done |
| 5 | Application: GetJobsByBoundsQuery (viewport-based) | ✅ Done |
| 6 | Application: GetJobDetailQuery | ✅ Done |
| 7 | Infrastructure: GeocodingService (Google API) | ✅ Done |
| 8 | Infrastructure: JobRequest EF config with GiST index | ✅ Done |
| 9 | Infrastructure: Partial index on status='Open' | ✅ Done |
| 10 | Api: `POST /api/jobs` (create) | ✅ Done |
| 11 | Api: `GET /api/jobs/map` (bounds query) | ✅ Done |
| 12 | Api: `GET /api/jobs/{id}` (detail) | ✅ Done |
| 13 | Api: `GET /api/jobs/nearby` (radius query) | ✅ Done |
| 14 | SignalR Hub: JobMapHub (real-time pin updates) | ✅ Done |
| 15 | Domain events: JobCreatedEvent | ✅ Done |
| 16 | Event handler: push new pin via SignalR | ✅ Done |

### Tests Required
- [ ] `CreateJob_ValidInput_ReturnsJobId`
- [ ] `CreateJob_InvalidAddress_GeocodeFailsReturns400`
- [ ] `CreateJob_MissingFields_ValidationFails`
- [ ] `CreateJob_BudgetZero_Rejected`
- [ ] `GetJobsByBounds_ReturnsOpenJobs`
- [ ] `GetJobsByBounds_FiltersCategories`
- [ ] `GetJobsByBounds_RespectsLimit`
- [ ] `GetJobsByBounds_ViewportTooLarge_Returns400`
- [ ] `GetJobsByBounds_IncludesVendorRequestedFlag`
- [ ] `GetNearbyJobs_RadiusFilter_Works`
- [ ] `GetJobDetail_ExistingJob_ReturnsData`
- [ ] `GetJobDetail_NonExistent_Returns404`
- [ ] `PostGIS_GiSTIndex_UsedInQueryPlan` (integration)

### Definition of Done
- [ ] Customer can create a job and it appears in bounds query
- [ ] Geospatial index is verified in EXPLAIN output
- [ ] Map query returns ≤200ms for 1000 seeded jobs
- [ ] SignalR pushes JobCreated event to connected clients
- [ ] 13 tests passing
- [ ] EF migration applies cleanly

---

## Sprint 3: Vendor Request & Assignment Flow (Weeks 5-6)

### Goal
Full vendor request lifecycle: request from map → customer review → assign → reject others.

### Deliverables

| # | File / Feature | Status |
|---|---------------|--------|
| 1 | Domain: VendorRequest, JobAssignment entities | ✅ Done |
| 2 | Application: RequestJobCommand + Handler | ✅ Done |
| 3 | Application: AssignVendorCommand + Handler | ✅ Done |
| 4 | Application: WithdrawRequestCommand + Handler | ✅ Done |
| 5 | Application: GetJobRequestsQuery (customer view) | ✅ Done |
| 6 | Application: UpdateJobStatusCommand (InProgress, Completed) | ✅ Done |
| 7 | Application: CancelJobCommand + late-cancel penalty | ✅ Done |
| 8 | Application: RescheduleJobCommand | ✅ Done |
| 9 | Domain events: VendorRequestedEvent, JobAssignedEvent, JobCompletedEvent | ✅ Done |
| 10 | Api: `POST /api/jobs/{id}/requests` | ✅ Done |
| 11 | Api: `GET /api/jobs/{id}/requests` | ✅ Done |
| 12 | Api: `PUT /api/jobs/{id}/assign` | ✅ Done |
| 13 | Api: `DELETE /api/jobs/{id}/requests/mine` | ✅ Done |
| 14 | Api: `PUT /api/jobs/{id}/status` | ✅ Done |
| 15 | Api: `PUT /api/jobs/{id}/cancel` | ✅ Done |
| 16 | Api: `PUT /api/jobs/{id}/reschedule` | ✅ Done |

### Tests Required
- [ ] `RequestJob_ApprovedVendor_Succeeds`
- [ ] `RequestJob_UnverifiedVendor_Rejected`
- [ ] `RequestJob_DuplicateRequest_Rejected`
- [ ] `RequestJob_ClosedJob_Rejected`
- [ ] `AssignVendor_OwnerOnly_NonOwnerRejected`
- [ ] `AssignVendor_RejectsOtherPendingRequests`
- [ ] `AssignVendor_CreatesJobAssignment`
- [ ] `WithdrawRequest_PendingRequest_Succeeds`
- [ ] `WithdrawRequest_AfterAssignment_ReopensJob`
- [ ] `CancelJob_Open_Succeeds_NoPenalty`
- [ ] `CancelJob_Assigned_LatePenalty_Applied`
- [ ] `CancelJob_InProgress_Rejected`
- [ ] `UpdateStatus_Assigned_ToInProgress_Succeeds`
- [ ] `UpdateStatus_InvalidTransition_Rejected`
- [ ] `Reschedule_Assigned_NotifiesVendor`
- [ ] `ConcurrentRequests_BothSucceed` (concurrency test)

### Definition of Done
- [ ] Complete happy path: create → request → assign → start → complete
- [ ] Cancellation with penalty logic verified
- [ ] Vendor withdrawal re-opens job correctly
- [ ] 16 tests passing
- [ ] No race conditions in concurrent request scenarios

---

## Sprint 4: Payments & Commission (Weeks 7-8)

### Goal
End-to-end payment: customer confirms → Stripe charges → platform fee deducted → vendor paid.

### Deliverables

| # | File / Feature | Status |
|---|---------------|--------|
| 1 | Domain: PaymentTransaction, Payout, LedgerEntry, CommissionConfig | ✅ Done |
| 2 | Application: CapturePaymentCommand with commission calculation | ✅ Done |
| 3 | Application: IPaymentService (full interface) | ✅ Done |
| 4 | Application: ICommissionService | ✅ Done |
| 5 | Infrastructure: StripePaymentService (idempotency keys) | ✅ Done |
| 6 | Infrastructure: CommissionService (rate resolution) | ✅ Done |
| 7 | Api: `POST /api/payments/capture` | ✅ Done |
| 8 | Api: `POST /api/webhooks/stripe` (webhook handler) | ✅ Done |
| 9 | Api: `POST /api/vendors/stripe/onboard` | ✅ Done |
| 10 | Api: `GET /api/vendors/stripe/status` | ✅ Done |
| 11 | Domain: ProcessedWebhookEvent (idempotency) | ✅ Done |
| 12 | Ledger entries: payment_received, platform_fee, stripe_fee, vendor_earned | ✅ Done |
| 13 | Webhook handlers: payment_intent.succeeded/failed, transfer.failed, charge.refunded | ✅ Done |

### Tests Required
- [ ] `CapturePayment_CompletedJob_Succeeds`
- [ ] `CapturePayment_NotCompleted_Rejected`
- [ ] `CapturePayment_AlreadyPaid_IdempotentReturn`
- [ ] `CapturePayment_VendorNoStripe_Rejected`
- [ ] `CommissionService_GlobalDefault_Returns15Percent`
- [ ] `CommissionService_CategoryOverride_UsesLowest`
- [ ] `CommissionService_VendorOverride_TakesPriority`
- [ ] `Webhook_PaymentSucceeded_UpdatesTransaction`
- [ ] `Webhook_DuplicateEvent_Skipped`
- [ ] `Webhook_InvalidSignature_Returns400`
- [ ] `LedgerEntries_BalanceCorrect_AfterCapture`
- [ ] `VendorOnboard_CreatesStripeAccount`
- [ ] `StripePaymentService_IdempotencyKey_Format`

### Definition of Done
- [ ] Payment capture creates correct ledger entries
- [ ] Commission rates resolve correctly (vendor > category > global)
- [ ] Webhook deduplication works
- [ ] Stripe test mode integration verified
- [ ] 13 tests passing

---

## Sprint 5: Frontend — Map Discovery UI (Weeks 9-10)

### Goal
Vendor-facing map with pins, clustering, job cards, and "Request Job" flow.

### Deliverables

| # | File / Feature | Status |
|---|---------------|--------|
| 1 | React/Next.js project scaffolding | ⬜ |
| 2 | Google Maps integration (`@react-google-maps/api`) | ⬜ |
| 3 | Map component with vendor location centering | ⬜ |
| 4 | Pin rendering from `/api/jobs/map` response | ⬜ |
| 5 | Marker clustering (`@googlemaps/markerclusterer`) | ⬜ |
| 6 | Pin color/icon by job category | ⬜ |
| 7 | Job Card overlay on pin click | ⬜ |
| 8 | "Request Job" CTA → calls `POST /api/jobs/{id}/requests` | ⬜ |
| 9 | Optimistic UI: pin state change on request | ⬜ |
| 10 | Sidebar filters (category, budget, date) | ⬜ |
| 11 | Debounced bounds-based fetch (300ms) | ⬜ |
| 12 | SignalR connection for real-time pin updates | ⬜ |
| 13 | List view fallback (accessibility) | ⬜ |
| 14 | Auth flow: login → JWT → stored in memory | ⬜ |
| 15 | Error toasts for stale/claimed jobs | ⬜ |

### Tests Required
- [ ] Map renders and centers on vendor location
- [ ] Pins appear for mock job data
- [ ] Clicking pin opens job card with correct data
- [ ] "Request Job" calls API and updates pin state
- [ ] Filter changes trigger new API call
- [ ] Clustering activates at low zoom
- [ ] SignalR connection establishes on mount
- [ ] List view shows same data as map

### Definition of Done
- [ ] Vendor can see jobs on map, click pins, request jobs
- [ ] Clustering works at zoom < 13
- [ ] Debounce prevents excess API calls
- [ ] Responsive on mobile (375px+)
- [ ] Keyboard-accessible list alternative

---

## Sprint 6: Frontend — Customer Flows & Notifications (Weeks 11-12)

### Goal
Customer can post jobs, review requests, accept vendors, confirm payment. Notifications work.

### Deliverables

| # | File / Feature | Status |
|---|---------------|--------|
| 1 | Job creation form (address, categories, budget, schedule, photos) | ⬜ |
| 2 | Address autocomplete (Google Places) | ⬜ |
| 3 | Job detail page with status badge | ⬜ |
| 4 | Vendor request list (customer reviews) | ⬜ |
| 5 | Accept/reject vendor actions | ⬜ |
| 6 | Job status tracker (timeline component) | ⬜ |
| 7 | Payment confirmation UI (Stripe Elements) | ⬜ |
| 8 | Rating submission form | ⬜ |
| 9 | Notification bell with unread count | ⬜ |
| 10 | Notification dropdown/page | ⬜ |
| 11 | Notification preferences settings page | ⬜ |
| 12 | Backend: NotificationDispatcher (outbox pattern) | ✅ Done |
| 13 | Backend: OutboxProcessor (background worker) | ✅ Done |
| 14 | Backend: Preference service | ✅ Done |
| 15 | Backend: Template renderer | ✅ Done |

### Tests Required
- [ ] Job creation form validates and submits
- [ ] Vendor request list loads and displays correctly
- [ ] Accept vendor triggers assignment
- [ ] Payment UI renders Stripe Elements
- [ ] Notification count updates in real-time
- [ ] Preference changes persist via API
- [ ] OutboxProcessor delivers notifications within 60s
- [ ] Dead letter entries surface correctly

### Definition of Done
- [ ] Customer can post job → review vendors → assign → confirm pay
- [ ] Notifications appear in-app within 5s of event
- [ ] Email notifications sent (dev: logged to console)
- [ ] Preferences UI allows opt-in/opt-out

---

## Sprint 7: Admin Portal & Compliance (Weeks 13-14)

### Goal
Admin dashboard with KPIs, user/vendor/job management, disputes, and compliance endpoints.

### Deliverables

| # | File / Feature | Status |
|---|---------------|--------|
| 1 | Backend: Full AdminController (20 endpoints) | ✅ Done |
| 2 | Backend: Admin RBAC (Owner/Admin/Support) | ✅ Done |
| 3 | Backend: Audit log with immutable entries | ✅ Done |
| 4 | Backend: CommissionConfig CRUD | ✅ Done |
| 5 | Backend: ComplianceController (consent, abuse reports, CCPA) | ✅ Done |
| 6 | Frontend: Admin dashboard with KPI cards | ⬜ |
| 7 | Frontend: User management table (search, filter, suspend) | ⬜ |
| 8 | Frontend: Vendor verification queue | ⬜ |
| 9 | Frontend: Dispute management view | ⬜ |
| 10 | Frontend: Financial reports (revenue, payouts) | ⬜ |
| 11 | Frontend: Audit log viewer | ⬜ |
| 12 | Frontend: Commission rate management | ⬜ |
| 13 | Consent banner component (cookie, ToS re-acceptance) | ⬜ |

### Tests Required
- [ ] `AdminDashboard_ReturnsAllKpis`
- [ ] `AdminUserList_FiltersWork`
- [ ] `AdminSuspendUser_CreatesAuditEntry`
- [ ] `AdminVerifyVendor_ApproveUpdatesStatus`
- [ ] `AdminResolveDispute_UpdatesStatusAndAudit`
- [ ] `AdminCommission_Create_OwnerOnly`
- [ ] `AuditLog_Query_FiltersByAction`
- [ ] `AuditLog_Immutable_CannotUpdate`
- [ ] `ConsentRecord_Created_OnAcceptance`
- [ ] `AbuseReport_Submitted_AppearsInQueue`
- [ ] `CcpaOptOut_SetsCookie`

### Definition of Done
- [ ] Admin can view KPIs, manage users, verify vendors, resolve disputes
- [ ] Every admin action creates audit entry with IP + old/new values
- [ ] Consent records are immutable
- [ ] Abuse reports flow to admin queue
- [ ] Owner-only endpoints reject Admin role

---

## Sprint 8: Testing, Performance & Production Deploy (Weeks 15-16)

### Goal
Full test coverage, performance validation, CI/CD pipeline, and production deployment.

### Deliverables

| # | File / Feature | Status |
|---|---------------|--------|
| 1 | Unit test project: `Rakr.Tests.Unit` | ⬜ |
| 2 | Integration test project: `Rakr.Tests.Integration` | ⬜ |
| 3 | E2E test project: `Rakr.Tests.E2E` | ⬜ |
| 4 | Testcontainers setup (PostgreSQL + PostGIS) | ⬜ |
| 5 | Performance tests: map query with 10k jobs | ⬜ |
| 6 | Load test: 500 concurrent users (k6 or NBomber) | ⬜ |
| 7 | CI pipeline (GitHub Actions): build → test → scan → deploy | ⬜ |
| 8 | Dockerfile optimization (multi-stage, non-root) | ✅ Done |
| 9 | Production docker-compose with replicas | ✅ Done |
| 10 | OpenTelemetry + Prometheus metrics | ✅ Done |
| 11 | Health checks (readiness + liveness) | ✅ Done |
| 12 | Blue-green deployment configuration | ⬜ |
| 13 | EF migration: production apply script | ⬜ |
| 14 | Secrets rotation procedure | ⬜ |
| 15 | Runbook documentation | ✅ Done |

### Definition of Done
- [ ] ≥ 70% code coverage
- [ ] All integration tests pass against real PostgreSQL (Testcontainers)
- [ ] Map query < 200ms p95 with 10k seeded jobs
- [ ] CI pipeline passes all gates
- [ ] Production deploy completes with zero-downtime
- [ ] Health checks pass in production
- [ ] Rollback procedure verified

---

## 3. Test Plan

### 3.1 Test Pyramid

```
        ╱╲
       ╱ E2E ╲         5-10 tests (critical paths only)
      ╱────────╲
     ╱Integration╲     30-50 tests (API + DB)
    ╱──────────────╲
   ╱   Unit Tests   ╲  100+ tests (handlers, validators, services)
  ╱──────────────────╲
```

### 3.2 Unit Tests (src/Rakr.Tests.Unit)

| Module | Test Count | Focus |
|--------|-----------|-------|
| Jobs/Commands | 20 | CreateJob, RequestJob, AssignVendor, Cancel, Withdraw, Reschedule |
| Jobs/Queries | 10 | GetNearbyJobs, GetJobsByBounds, GetJobDetail, GetJobRequests |
| Payments | 10 | CapturePayment, CommissionService, FeeCalculation |
| Auth | 8 | AuthService (mocked UserManager) |
| Notifications | 8 | Dispatcher, PreferenceService, TemplateRenderer |
| Validators | 10 | CreateJobValidator, BoundsValidator |
| **Total** | **~66** | |

**Mocking strategy:** MediatR handlers tested with mocked `IAppDbContext` (in-memory or Moq).

### 3.3 Integration Tests (src/Rakr.Tests.Integration)

| Scenario | Count | Setup |
|----------|-------|-------|
| Auth endpoints (register, login, refresh) | 8 | Testcontainers PostgreSQL |
| Job CRUD with real PostGIS | 10 | Seeded test data |
| Payment flow (Stripe test mode) | 5 | Stripe test keys |
| Admin operations | 8 | Admin-seeded user |
| Webhook processing | 5 | Mocked Stripe events |
| Notification outbox | 4 | Verify entries created |
| **Total** | **~40** | |

**Framework:** `WebApplicationFactory<Program>` + Testcontainers for PostgreSQL with PostGIS.

### 3.4 E2E Tests (src/Rakr.Tests.E2E)

| Scenario | Steps |
|----------|-------|
| Happy path: Post → Request → Assign → Complete → Pay | 8 API calls in sequence |
| Vendor map discovery → request job | Auth + bounds query + request |
| Customer cancels assigned job | Create → assign → cancel (verify notifications) |
| Admin verifies vendor → vendor requests job | Role-based flow |
| Payment failure → retry | Capture with bad card → verify retry |
| **Total** | **5-8 scenarios** |

**Framework:** Playwright (for frontend) or raw HttpClient (API-only E2E).

---

## 4. CI Pipeline Gates

### 4.1 Pipeline Definition (GitHub Actions)

```yaml
name: CI/CD Pipeline
on: [push, pull_request]

jobs:
  build-and-test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgis/postgis:16-3.4
        env:
          POSTGRES_PASSWORD: test
        ports: ['5432:5432']
        options: --health-cmd pg_isready

    steps:
      - uses: actions/checkout@v4

      # Gate 1: Restore & Build
      - run: dotnet restore
      - run: dotnet build --no-restore -warnaserror

      # Gate 2: Unit Tests
      - run: dotnet test tests/Rakr.Tests.Unit --no-build --collect:"XPlat Code Coverage"

      # Gate 3: Integration Tests
      - run: dotnet test tests/Rakr.Tests.Integration --no-build
        env:
          ConnectionStrings__DefaultConnection: "Host=localhost;..."

      # Gate 4: Code Coverage Check
      - uses: codecov/codecov-action@v4
        # Fail if < 70%

      # Gate 5: Security Scan (SAST)
      - uses: snyk/actions/dotnet@master
        with:
          args: --severity-threshold=high

      # Gate 6: Container Build + Scan
      - run: docker build -t Rakr-api:${{ github.sha }} .
      - uses: aquasecurity/trivy-action@master
        with:
          image-ref: Rakr-api:${{ github.sha }}
          severity: CRITICAL,HIGH
          exit-code: 1

      # Gate 7: Deploy to Staging
      - run: ./scripts/deploy-staging.sh

      # Gate 8: Smoke Tests against Staging
      - run: dotnet test tests/Rakr.Tests.E2E
        env:
          API_BASE_URL: https://staging.Rakr.com
```

### 4.2 Gate Summary

| Gate | Tool | Blocks PR? | Blocks Deploy? |
|------|------|-----------|---------------|
| Build (0 errors, 0 warnings) | `dotnet build -warnaserror` | ✅ | ✅ |
| Unit tests (100% pass) | `dotnet test` | ✅ | ✅ |
| Integration tests (100% pass) | `dotnet test` + Testcontainers | ✅ | ✅ |
| Code coverage (≥ 70%) | Codecov | ⚠️ Warning | ❌ |
| SAST scan (no critical/high) | Snyk | ✅ | ✅ |
| Dependency audit (no critical CVEs) | `dotnet list package --vulnerable` | ✅ | ✅ |
| Container scan (no critical) | Trivy | ✅ | ✅ |
| Lint (code style) | `dotnet format --verify-no-changes` | ⚠️ Warning | ❌ |
| E2E smoke (staging) | Custom test suite | ❌ | ✅ |
| Performance regression (< 10% latency) | k6 / NBomber | ❌ | ⚠️ Warning |

---

## 5. Release Checklist

### 5.1 Pre-Release (1 day before)

- [ ] All CI gates passing on release branch
- [ ] Database migration tested on staging (applied + verified)
- [ ] Staging smoke tests pass
- [ ] No open SEV1/SEV2 bugs
- [ ] Release notes drafted
- [ ] Rollback plan documented and tested
- [ ] On-call engineer identified and briefed
- [ ] External dependencies verified (Stripe, Google Maps, SendGrid)
- [ ] Feature flags set correctly for new features

### 5.2 Release Day

- [ ] Notify team in #deployments channel
- [ ] Tag release: `git tag v{major}.{minor}.{patch}`
- [ ] Push container image to production registry
- [ ] Apply database migrations (if any)
- [ ] Deploy to GREEN target group
- [ ] Verify health checks pass (2 minutes)
- [ ] Shift 10% traffic to GREEN (canary)
- [ ] Monitor error rate for 5 minutes
- [ ] If healthy: shift 100% traffic
- [ ] If errors: immediate rollback to BLUE
- [ ] Verify Prometheus metrics normal
- [ ] Verify SignalR connections re-established
- [ ] Run post-deploy smoke test
- [ ] Update status page: "Deployment complete"

### 5.3 Post-Release (within 1 hour)

- [ ] Monitor error rate and latency dashboards
- [ ] Check notification outbox depth (no backlog)
- [ ] Verify webhook events processing
- [ ] Check failed payout count
- [ ] Confirm no increase in 4xx/5xx rates
- [ ] Close deployment ticket
- [ ] Announce in #releases channel

### 5.4 Rollback Criteria (Auto or Manual)

| Trigger | Action | SLA |
|---------|--------|-----|
| Health check fails during canary | Auto-rollback to BLUE | < 30s |
| Error rate > 2% for 2 minutes | Auto-rollback | < 60s |
| p95 latency > 3s for 5 minutes | Manual rollback decision | < 5min |
| Payment failures > 5% | Immediate manual rollback | < 2min |
| Data corruption detected | Rollback + PITR restore | < 30min |

---

## 6. File-Level Implementation Status

### Backend (Complete)

```
src/Rakr.Domain/
├── Common/          (3 files) ✅
├── Entities/        (20 files) ✅
├── Enums/           (7 files) ✅
└── Events/          (5 files) ✅

src/Rakr.Application/
├── Auth/            (2 files) ✅
├── Common/          (7 files) ✅
├── Jobs/            (16 files) ✅
├── Notifications/   (5 files) ✅
├── Payments/        (2 files) ✅
└── Ratings/         (2 files) ✅

src/Rakr.Infrastructure/
├── Identity/        (5 files) ✅
├── Hubs/            (1 file) ✅
├── Notifications/   (5 files) ✅
├── Persistence/     (13 files) ✅
└── Services/        (6 files) ✅

src/Rakr.Api/
├── Controllers/     (10 files) ✅
├── Program.cs       ✅
└── Dockerfile       ✅
```

### Frontend (Sprint 5-6)

```
frontend/                          (⬜ All pending)
├── src/
│   ├── components/
│   │   ├── Map/
│   │   │   ├── MapContainer.tsx
│   │   │   ├── JobPin.tsx
│   │   │   ├── JobCard.tsx
│   │   │   └── MapFilters.tsx
│   │   ├── Jobs/
│   │   │   ├── CreateJobForm.tsx
│   │   │   ├── JobDetail.tsx
│   │   │   ├── VendorRequestList.tsx
│   │   │   └── JobStatusTracker.tsx
│   │   ├── Notifications/
│   │   │   ├── NotificationBell.tsx
│   │   │   └── PreferencesForm.tsx
│   │   └── Admin/
│   │       ├── Dashboard.tsx
│   │       ├── UserTable.tsx
│   │       └── DisputeView.tsx
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useMapJobs.ts
│   │   └── useSignalR.ts
│   ├── services/
│   │   ├── api.ts
│   │   └── auth.ts
│   └── pages/
│       ├── vendor/map.tsx
│       ├── customer/jobs/[id].tsx
│       └── admin/dashboard.tsx
└── package.json
```

### Tests (Sprint 8)

```
tests/                             (⬜ All pending)
├── Rakr.Tests.Unit/
│   ├── Jobs/
│   ├── Payments/
│   ├── Auth/
│   └── Notifications/
├── Rakr.Tests.Integration/
│   ├── Fixtures/
│   ├── Jobs/
│   ├── Auth/
│   └── Payments/
└── Rakr.Tests.E2E/
    ├── HappyPathTests.cs
    └── FailureScenarioTests.cs
```

---

## 7. Risk Register

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|-----------|
| Stripe Connect region restrictions | Low | High | Verify Express availability early |
| Google Maps API cost at scale | Medium | Medium | Cache aggressively; budget alerts |
| PostGIS performance at 50k+ jobs | Low | High | Benchmarked in Sprint 2; read replicas ready |
| Independent contractor misclassification | Medium | High | Legal review in Sprint 7; AB5 analysis |
| Frontend complexity (map + real-time) | Medium | Medium | Spike in Sprint 4; fallback list view |
| Stripe webhook reliability | Low | Medium | Reconciliation job; manual retry |
