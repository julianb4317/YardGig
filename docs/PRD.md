# Product Requirements Document: Rakr – Yard-Work Gig Marketplace

## 1. Problem Statement

Homeowners and property managers need reliable, on-demand yard-work services (mowing, leaf removal, hedge trimming, snow clearing, etc.) but struggle to find vetted local providers quickly. Existing platforms (Craigslist, Nextdoor, Thumbtack) lack real-time geographic discovery, transparent pricing, and integrated payments tailored to outdoor maintenance work.

**Rakr** connects customers who post yard-work jobs with local vendors who discover and claim jobs via an interactive map interface — reducing friction for both sides and providing trust, scheduling, and payment infrastructure.

---

## 2. Actors / User Personas

### 2.1 Customer (Homeowner / Property Manager)

| Attribute | Detail |
|-----------|--------|
| Goals | Post a job quickly, get matched with a nearby vendor, pay securely, rate quality |
| Pain Points | Unreliable providers, opaque pricing, scheduling uncertainty |
| Tech Comfort | Moderate — expects mobile-first responsive web |

### 2.2 Vendor (Service Provider)

| Attribute | Detail |
|-----------|--------|
| Goals | Find jobs near current location, build reputation, get paid promptly |
| Pain Points | Wasted drive time, no-show customers, delayed payments |
| Tech Comfort | Moderate — primarily uses phone between jobs |

### 2.3 Admin (Platform Operator)

| Attribute | Detail |
|-----------|--------|
| Goals | Ensure trust/safety, resolve disputes, monitor platform health, manage payouts |
| Pain Points | Fraud, bad actors, support ticket volume |
| Tech Comfort | High — uses internal dashboards |

---

## 3. User Journeys

### 3.1 Customer Journey

1. Signs up / logs in (email or OAuth).
2. Creates a Job Request: title, description, category, photos, address (geocoded to lat/lng), budget range, preferred schedule window.
3. Job appears as a pin on the map for nearby vendors.
4. Receives vendor request notifications.
5. Reviews vendor profile, ratings, and proposed price.
6. Accepts a vendor → Job moves to "Assigned."
7. Vendor completes work → Customer confirms completion.
8. Payment is captured; customer rates vendor.

### 3.2 Vendor Journey

1. Signs up / logs in; completes profile (services offered, service radius, insurance docs).
2. Opens the **Map Discovery** view — sees job pins within their service radius.
3. Clicks a pin → Job Card flyout shows title, category, budget, schedule, distance.
4. Taps **"Request Job"** on the card.
5. Customer accepts → Vendor sees assignment details.
6. Completes work and marks job as done.
7. Payment deposited to vendor wallet; vendor rates customer.

### 3.3 Admin Journey

1. Logs into admin dashboard.
2. Reviews flagged jobs / disputes.
3. Suspends bad actors; approves vendor documents.
4. Monitors KPIs: time-to-match, completion rate, revenue.

---

## 4. MVP Features (Numbered)

| # | Feature | Actor |
|---|---------|-------|
| F1 | Email + OAuth registration/login with email verification | All |
| F2 | Customer profile management (address, payment method) | Customer |
| F3 | Vendor profile management (services, radius, docs, payout info) | Vendor |
| F4 | Job Request creation with address geocoding and category tagging | Customer |
| F5 | **Map-based job discovery** — Google Map with clustered pins; vendors filter by category, distance, budget | Vendor |
| F6 | Job Card popup on pin click with job details and **"Request Job"** button | Vendor |
| F7 | Vendor request management — customer reviews & accepts/rejects | Customer |
| F8 | Job lifecycle state machine (Draft → Open → Requested → Assigned → In-Progress → Completed → Paid → Closed) | All |
| F9 | In-app notifications (email + push-ready) for state transitions | All |
| F10 | Payment capture on job completion (Stripe Connect) | All |
| F11 | Rating & review system (bi-directional) | Customer, Vendor |
| F12 | Admin dashboard — user management, dispute queue, KPI widgets | Admin |
| F13 | Basic dispute workflow (flag → review → resolve) | All |

---

## 5. Map-Based Discovery Requirements (F5 & F6 Detail)

| Req ID | Requirement |
|--------|-------------|
| MAP-1 | Embed Google Maps JavaScript API; default center = vendor's registered address or browser GPS location. |
| MAP-2 | Render job pins for all jobs with status `Open` within vendor's configured service radius (default 15 mi). |
| MAP-3 | Cluster pins at low zoom levels; expand to individual pins at zoom ≥ 13. |
| MAP-4 | Clicking a pin opens a **Job Card** overlay containing: title, category icon, budget range, schedule window, distance from vendor, truncated description (120 chars). |
| MAP-5 | Job Card contains a primary **"Request Job"** CTA button. |
| MAP-6 | "Request Job" creates a `VendorRequest` entity, transitions the request to the customer's review queue, and provides instant feedback (toast + pin color change). |
| MAP-7 | Sidebar filters: category multi-select, budget min/max, date range, sort by distance/date. |
| MAP-8 | Real-time pin refresh via SignalR when new jobs are posted or claimed. |
| MAP-9 | Geospatial query must return results within 200 ms for 10,000 concurrent open jobs in a metro area. |

---

## 6. Out-of-Scope (Post-MVP)

- Native mobile apps (iOS/Android) — MVP is responsive web only.
- In-app chat / messaging between customer and vendor.
- Recurring/subscription job scheduling.
- Automated pricing engine / bidding.
- Background checks integration.
- Multi-language / i18n.
- Referral and promo-code system.
- SMS notifications.
- Service-area polygon drawing (circles only at MVP).

---

## 7. Non-Functional Requirements

| Category | Requirement |
|----------|-------------|
| **Performance** | Map pin query ≤ 200 ms p95 for 10k open jobs within 50 mi radius. Page load (LCP) ≤ 2.5 s. API response ≤ 500 ms p99. |
| **Scalability** | Horizontally scalable API behind load balancer; target 5,000 concurrent users at launch. |
| **Reliability** | 99.5% monthly uptime SLA. Graceful degradation if Google Maps or Stripe are unavailable. |
| **Security** | OWASP Top-10 mitigations. OAuth 2.0 + JWT. PCI-DSS compliance via Stripe (no card data stored). Row-level authorization. HTTPS everywhere. |
| **Data Privacy** | GDPR-aligned: data export, right-to-delete, consent tracking. |
| **Accessibility** | WCAG 2.1 AA for all non-map UI. Map interactions have keyboard-accessible alternatives (list view). |
| **Observability** | Structured logging (Serilog), distributed tracing (OpenTelemetry), health-check endpoints, Prometheus metrics. |

---

## 8. Acceptance Criteria (Given/When/Then)

### F1 — Registration & Login

```gherkin
Given a new user with a valid email
When they submit the registration form
Then an account is created, a verification email is sent, and they are redirected to the "Verify Email" screen.

Given a user with a verified email
When they log in with correct credentials
Then they receive a JWT access token and are redirected to their role-appropriate dashboard.

Given a user attempting login with incorrect credentials
When they submit the login form
Then an error message is shown and the account is locked after 5 consecutive failures.
```

### F2 — Customer Profile

```gherkin
Given a logged-in customer
When they update their address and save
Then the address is geocoded and stored, and their default job location is updated.

Given a logged-in customer
When they add a payment method via Stripe Elements
Then a Stripe Customer object is created and the card fingerprint is stored (no raw card data).
```

### F3 — Vendor Profile

```gherkin
Given a logged-in vendor
When they set their service categories, radius, and upload insurance documentation
Then the profile is saved and status becomes "Pending Verification."

Given an admin reviewing a vendor profile
When they approve the documentation
Then the vendor status becomes "Active" and they can view jobs on the map.
```

### F4 — Job Request Creation

```gherkin
Given a logged-in customer
When they fill in title, description, category, address, budget, and schedule window and submit
Then a JobRequest is created with status "Open," the address is geocoded to lat/lng, and the job appears as a map pin for vendors within range.

Given an address that cannot be geocoded
When the customer submits the job form
Then a validation error is displayed: "We couldn't locate this address. Please refine it."
```

### F5 — Map-Based Discovery

```gherkin
Given a logged-in vendor with GPS location enabled
When they open the Map Discovery view
Then the map centers on their location and displays pins for all Open jobs within their service radius.

Given more than 50 pins visible at the current zoom level
When the map renders
Then pins are clustered and the cluster shows a count badge.

Given a vendor with category filters applied
When the map refreshes
Then only jobs matching selected categories are shown as pins.
```

### F6 — Job Card & Request Job

```gherkin
Given a vendor viewing the map
When they click a job pin
Then a Job Card overlay appears with title, category, budget, schedule, distance, and a "Request Job" button.

Given a vendor viewing a Job Card
When they click "Request Job"
Then a VendorRequest record is created, the pin changes to "Requested" color, a toast confirms the action, and the customer receives a notification.

Given a vendor who has already requested a job
When they view that job's pin
Then the "Request Job" button is disabled and labeled "Requested."
```

### F7 — Vendor Request Management

```gherkin
Given a customer with pending vendor requests
When they open the Job detail page
Then they see a list of requesting vendors with profile summary, ratings, and distance.

Given a customer reviewing requests
When they accept a vendor
Then the job status moves to "Assigned," other requestors are notified of rejection, and the accepted vendor is notified.
```

### F8 — Job Lifecycle

```gherkin
Given a job in status "Assigned"
When the vendor marks it as "In-Progress"
Then the status updates and the customer is notified.

Given a job in status "In-Progress"
When the vendor marks it as "Completed"
Then the customer is prompted to confirm completion.
```

### F9 — Notifications

```gherkin
Given any job state transition
When the transition is persisted
Then an email notification is sent to all relevant parties within 60 seconds.
```

### F10 — Payment

```gherkin
Given a job in status "Completed" confirmed by the customer
When the system processes payment
Then the platform fee (15%) is deducted, the vendor payout is initiated via Stripe Connect, and a PaymentTransaction record is created.

Given a payout failure from Stripe
When the webhook reports failure
Then the PaymentTransaction is marked "Failed," an alert is sent to admin, and the vendor is notified to update payout info.
```

### F11 — Ratings

```gherkin
Given a completed and paid job
When the customer submits a 1–5 star rating with optional comment
Then the rating is saved, the vendor's average score is recalculated, and the rating is visible on the vendor's public profile.

Given a completed and paid job
When the vendor submits a rating for the customer
Then the customer's average score is updated.
```

### F12 — Admin Dashboard

```gherkin
Given an admin user
When they access the dashboard
Then they see KPI widgets (jobs created today, active vendors, revenue, disputes open) and can navigate to management views.
```

### F13 — Disputes

```gherkin
Given a customer or vendor on a completed job
When they flag a dispute with a reason
Then a Dispute record is created with status "Open" and appears in the admin queue.

Given an admin reviewing a dispute
When they resolve it (refund, no-action, or suspend user)
Then all parties are notified and the resolution is logged.
```

---

## 9. Open Questions

| # | Question | Owner |
|---|----------|-------|
| Q1 | Should vendors set their own price or only accept/reject the customer's budget? | Product |
| Q2 | What is the platform fee percentage? (Assumption: 15%) | Finance |
| Q3 | Do we require vendor insurance verification before activation? | Legal |
| Q4 | What geocoding fallback if Google Geocoding API is down? | Engineering |
| Q5 | Should job expiration be time-based (e.g., 7 days) or manual? | Product |
| Q6 | Is photo proof of completion required at MVP? | Product |
| Q7 | Do we support multiple jobs at the same address concurrently? | Product |
| Q8 | What is the maximum service radius a vendor can set? | Product |

---

## 10. Assumptions

1. Stripe Connect is available in all target launch markets.
2. Google Maps JavaScript API and Geocoding API are the primary map providers.
3. MVP launches in a single country (US) with English only.
4. Vendors are independent contractors, not employees.
5. Platform fee is 15% of job total, charged to vendor payout.
6. Job budgets are customer-set flat rates (not hourly).
7. Email is sufficient for MVP notifications; push notifications are post-MVP.
8. Vendors must be approved (profile verified) before they can request jobs.
9. One vendor is assigned per job (no crew dispatch at MVP).
10. Job addresses are visible to vendors only after assignment (approximate location shown on map via pin jitter for privacy).
