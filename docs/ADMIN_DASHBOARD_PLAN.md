# Rakr Admin Dashboard — Implementation Plan

## Overview

A separate web application (Next.js on port 3001) that provides CRM/ERP capabilities for managing the Rakr marketplace. Connects to the same backend API (`src/Rakr.Api`) using the existing admin endpoints + new ones as needed.

---

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Rakr App       │     │  Admin Dashboard │     │  Rakr API       │
│  (port 3000)    │────▶│  (port 3001)    │────▶│  (port 5209)    │
│  Customer/Vendor│     │  Internal Staff  │     │  Shared Backend  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

- **Separate Next.js app** in `/admin-dashboard/` folder
- **Same backend API** — uses existing `/api/admin/*` endpoints + new ones
- **Separate auth context** — admin users log in with their admin credentials
- **Runs on port 3001** alongside the main app on 3000

---

## Role-Based Access Control (RBAC)

### Roles Hierarchy

| Role | Access Level | Description |
|------|-------------|-------------|
| **Owner** | Full access | You. Sees everything, can do everything. |
| **Admin** | Full operational | All CRM/ERP modules, can't change owner settings |
| **Finance** | Financial modules | Revenue, payouts, commissions, refunds |
| **Support** | Customer service | Disputes, user management, job moderation |
| **Marketing** | Marketing tools | Analytics, user segments, promotions, communications |
| **Readonly** | View only | Dashboard metrics, reports (no actions) |

### Permission Matrix

| Module / Page | Owner | Admin | Finance | Support | Marketing | Readonly |
|---|---|---|---|---|---|---|
| Dashboard (metrics) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| User Management | ✅ | ✅ | ❌ | ✅ | ❌ | 👁 |
| Vendor Verification | ✅ | ✅ | ❌ | ✅ | ❌ | 👁 |
| Insurance Verification | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| Disputes | ✅ | ✅ | ❌ | ✅ | ❌ | 👁 |
| Job Moderation | ✅ | ✅ | ❌ | ✅ | ❌ | 👁 |
| Revenue & Fees | ✅ | ✅ | ✅ | ❌ | ❌ | 👁 |
| Payouts | ✅ | ✅ | ✅ | ❌ | ❌ | 👁 |
| Commissions | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Refunds | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Analytics | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Promotions | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ |
| Communications | ✅ | ✅ | ❌ | ✅ | ✅ | ❌ |
| Audit Log | ✅ | ✅ | ✅ | ❌ | ❌ | 👁 |
| System Settings | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

👁 = View only (no edit/action buttons)

---

## Modules & Pages

### Module 1: Dashboard (Home)

**Purpose:** At-a-glance business health metrics.

| Page | Description | Phase |
|------|-------------|-------|
| Overview | KPIs: jobs today, active vendors, revenue, disputes, payouts | 1 |
| Trends | Charts: jobs/day, revenue/day, user growth, completion rate | 2 |
| Alerts | Failed payouts, expiring insurance, unresolved disputes > 24h | 2 |

---

### Module 2: CRM — Customer & Vendor Management

**Purpose:** Manage all marketplace users.

| Page | Description | Phase |
|------|-------------|-------|
| Users List | Searchable/filterable table of all users (customers + vendors) | 1 |
| User Detail | Full profile, job history, payment history, disputes, notes | 1 |
| Suspend / Unsuspend | Block problematic users with reason and duration | 1 |
| Vendor Verification | Queue of pending vendors, approve/reject with reason | 1 |
| Insurance Verification | Review uploaded documents, approve/reject, set InsuranceVerified flag | 1 |
| Customer Profiles | View customer addresses, business info, payment methods | 2 |

---

### Module 3: CRM — Disputes & Support

**Purpose:** Handle customer/vendor disputes and communication.

| Page | Description | Phase |
|------|-------------|-------|
| Disputes Queue | All open disputes sorted by age, assignable to support reps | 1 |
| Dispute Detail | Full context: job info, both parties, evidence photos, chat | 1 |
| Dispute Chat | Admin responds in the dispute chat (same as user-facing) | 1 |
| Resolve / Dismiss | Close disputes with resolution notes, trigger refunds if needed | 1 |
| Internal Notes | Private notes visible only to admin team (not users) | 2 |
| Escalation Rules | Auto-assign disputes based on type/amount, SLA timers | 3 |

---

### Module 4: CRM — Job Moderation

**Purpose:** Oversee marketplace job quality.

| Page | Description | Phase |
|------|-------------|-------|
| Jobs List | All jobs with filters (status, category, flagged) | 1 |
| Job Detail | Full job view as admin (both customer and vendor perspective) | 1 |
| Hide / Force Cancel | Remove inappropriate jobs with audit trail | 1 |
| Abuse Reports | Queue of reported content (from user abuse report feature) | 2 |
| Content Policy | Configurable rules for auto-flagging (keywords, thresholds) | 3 |

---

### Module 5: ERP — Finance

**Purpose:** Track all money movement.

| Page | Description | Phase |
|------|-------------|-------|
| Revenue Dashboard | Total gross, platform fees, net revenue, period comparisons | 1 |
| Transactions | All payment transactions with search/filter | 1 |
| Payouts | Vendor payout queue: pending, completed, failed + retry | 1 |
| Refunds | Issue refunds, view refund history | 2 |
| Commission Config | Set/edit commission rates (global, category, vendor-specific) | 1 |
| Escrow Monitor | View all active auth holds, held escrows, released amounts | 2 |
| Financial Reports | Exportable reports: P&L, GMV, take rate, payout volume | 3 |

---

### Module 6: CRM — Marketing & Analytics

**Purpose:** Understand and grow the marketplace.

| Page | Description | Phase |
|------|-------------|-------|
| User Analytics | Signups over time, retention, churn, LTV estimates | 2 |
| Marketplace Health | Supply/demand balance, vendor coverage by area | 2 |
| Geo Analytics | Heat map of job density, vendor density, underserved areas | 3 |
| Promotions | Create/manage discount codes, referral bonuses | 3 |
| Email Campaigns | Broadcast announcements, re-engagement campaigns | 3 |
| Push Notifications | Send targeted push notifications to user segments | 3 |

---

### Module 7: ERP — Operations

**Purpose:** Internal business operations.

| Page | Description | Phase |
|------|-------------|-------|
| Audit Log | Full audit trail: who did what, when, with before/after values | 1 |
| System Health | API response times, error rates, background job status | 3 |
| Feature Flags | Toggle features on/off without deploys | 3 |
| Employee Management | Staff accounts, roles, permissions | 3 |
| Timesheet / Hours | Employee time tracking (future) | 4 |

---

### Module 8: System Settings (Owner Only)

**Purpose:** Platform-level configuration.

| Page | Description | Phase |
|------|-------------|-------|
| Platform Fees | Trust fee %, processing fee formula | 1 |
| Role Management | Create/edit roles, assign permissions | 2 |
| API Keys | Manage Stripe, Google Places, SendGrid keys | 2 |
| Branding | App name, logo, colors, email templates | 3 |
| Legal Docs | Terms of Service, Privacy Policy version management | 3 |

---

## Phased Implementation

### Phase 1 — Core Operations (MVP Admin)
- Dashboard overview with key metrics
- User list + detail + suspend
- Vendor verification queue + insurance verification
- Disputes queue + detail + chat + resolve
- Job list + hide/cancel
- Revenue dashboard + transactions
- Payout management (view, retry failed)
- Commission configuration
- Audit log

**Estimated effort:** 1-2 sessions

### Phase 2 — Enhanced CRM
- Trends/charts on dashboard
- Alert system (failed payouts, aging disputes)
- Customer profile deep-dive
- Refund management
- Escrow monitoring
- User analytics
- Internal notes on disputes

**Estimated effort:** 1-2 sessions

### Phase 3 — Growth & Marketing
- Geo analytics / heat maps
- Promotions / discount codes
- Email campaigns
- Push notification targeting
- Abuse report queue
- Content policy / auto-flagging
- System health monitoring
- Feature flags
- Financial report exports

**Estimated effort:** 2-3 sessions

### Phase 4 — Enterprise
- Employee management
- Timesheets
- Advanced role/permission editor
- Multi-tenant considerations
- SSO / SAML for admin staff

**Estimated effort:** Future

---

## Technical Decisions

### Frontend Stack
- **Next.js 15** (same as main app for consistency)
- **Tailwind CSS** with a more "business/dashboard" aesthetic (darker sidebar, data tables)
- **TanStack Query** for data fetching
- **Recharts** or **Chart.js** for analytics/trends
- **TanStack Table** for sortable/filterable data tables
- **Same `apiClient`** pattern for API calls

### Layout
```
┌──────────────────────────────────────────────────┐
│  Sidebar (collapsible)  │  Header (user + search)│
│                         │                        │
│  📊 Dashboard           │  ┌──────────────────┐  │
│  👥 Users               │  │                  │  │
│  🛡 Verification        │  │   Content Area   │  │
│  ⚠️ Disputes            │  │                  │  │
│  💼 Jobs                │  │   (tables,       │  │
│  💰 Finance             │  │    forms,        │  │
│  📈 Analytics           │  │    charts)       │  │
│  📋 Audit               │  │                  │  │
│  ⚙️ Settings            │  └──────────────────┘  │
└──────────────────────────────────────────────────┘
```

### API Strategy
- Reuse existing `/api/admin/*` endpoints (already built)
- Add new endpoints as needed for missing functionality
- Admin endpoints are all gated by `[Authorize(Policy = "AdminOnly")]`
- Sub-policies for Finance/Support/Marketing roles (Phase 2)

### Deployment
- Separate Dockerfile in `/admin-dashboard/`
- Same docker-compose can run both apps
- Different domain in production: `admin.rakr.com` vs `app.rakr.com`
- Or same domain with path prefix: `rakr.com/admin` (simpler SSL)

---

## Existing Backend Endpoints (Already Built)

These endpoints in `AdminController.cs` are ready to use:

| Endpoint | Description |
|---|---|
| `GET /api/admin/dashboard` | KPI metrics |
| `GET /api/admin/dashboard/trends` | Job + revenue trends by day |
| `GET /api/admin/users` | List users (search, filter, paginate) |
| `GET /api/admin/users/{id}` | User detail with stats |
| `PUT /api/admin/users/{id}/suspend` | Suspend a user |
| `PUT /api/admin/users/{id}/unsuspend` | Reactivate a user |
| `GET /api/admin/vendors/pending` | Pending verification queue |
| `GET /api/admin/vendors/{id}` | Vendor detail |
| `PUT /api/admin/vendors/{id}/verify` | Approve/reject vendor |
| `GET /api/admin/jobs` | List all jobs (filter by status/category) |
| `PUT /api/admin/jobs/{id}/hide` | Hide a job |
| `PUT /api/admin/jobs/{id}/cancel` | Force-cancel a job |
| `GET /api/admin/disputes` | Open disputes queue |
| `GET /api/admin/disputes/{id}` | Dispute detail |
| `PUT /api/admin/disputes/{id}/resolve` | Resolve a dispute |
| `POST /api/admin/disputes/{id}/notes` | Add internal note |
| `GET /api/admin/finance/revenue` | Revenue summary |
| `GET /api/admin/finance/payouts` | Payout list |
| `PUT /api/admin/finance/payouts/{id}/retry` | Retry failed payout |
| `GET /api/admin/finance/commissions` | Commission configs |
| `POST /api/admin/finance/commissions` | Create commission rate |
| `PUT /api/admin/finance/commissions/{id}` | Deactivate commission |
| `GET /api/admin/audit` | Audit log (filterable) |

### New Endpoints Needed (Phase 1)

| Endpoint | Description |
|---|---|
| `PUT /api/admin/vendors/{id}/verify-insurance` | Set InsuranceVerified flag |
| `GET /api/admin/disputes/{id}/messages` | Get dispute chat (admin view) |
| `POST /api/admin/disputes/{id}/messages` | Send message as admin in dispute chat |
| `GET /api/admin/escrow` | List all active escrow holds |
| `POST /api/admin/refunds` | Issue a refund |

---

## Prompt for Implementation

> Build Phase 1 of the Rakr Admin Dashboard following the plan in `docs/ADMIN_DASHBOARD_PLAN.md`. Create a new Next.js app in `/admin-dashboard/` running on port 3001. Include: sidebar navigation, dashboard overview page with KPI cards, users list with search/filter, vendor verification queue with approve/reject, insurance verification, disputes queue with chat, job moderation, revenue dashboard, payout management, commission config, and audit log. Use the existing `/api/admin/*` endpoints. Match the Rakr frontend patterns (TanStack Query, Tailwind, same apiClient pattern). Add role-based sidebar visibility based on user role.
