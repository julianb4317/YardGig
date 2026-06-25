# Backend Gap Analysis — UI Requirements vs. Available Swagger Endpoints

## Summary

**Available endpoints verified:** 47 endpoints across 12 controllers
**UI requirements mapped from:** PRD (F1-F13), Implementation Plan (Sprints 1-8), Acceptance Criteria

**Result: 8 gaps identified** (2 blockers, 3 high, 2 medium, 1 low)

---

## Complete Endpoint Inventory (Available in Swagger)

### Auth (`/api/auth`)
| ✅ | Method | Endpoint | UI Screen |
|----|--------|----------|-----------|
| ✅ | POST | `/api/auth/register` | Register page |
| ✅ | POST | `/api/auth/login` | Login page |
| ✅ | POST | `/api/auth/google` | Google sign-in button |
| ✅ | POST | `/api/auth/confirm-email` | Email confirmation |
| ✅ | POST | `/api/auth/resend-confirmation` | Resend link |
| ✅ | POST | `/api/auth/forgot-password` | Forgot password page |
| ✅ | POST | `/api/auth/reset-password` | Reset password page |
| ✅ | POST | `/api/auth/refresh` | Auto token refresh |
| ✅ | POST | `/api/auth/revoke` | Logout |
| ✅ | GET | `/api/auth/mfa/setup` | MFA settings |
| ✅ | POST | `/api/auth/mfa/verify` | MFA verification |

### Jobs (`/api/jobs`)
| ✅ | Method | Endpoint | UI Screen |
|----|--------|----------|-----------|
| ✅ | POST | `/api/jobs` | Create job form |
| ✅ | GET | `/api/jobs/{id}` | Job detail page |
| ✅ | GET | `/api/jobs/mine` | Customer dashboard |
| ✅ | GET | `/api/jobs/map` | Vendor map/list view |
| ✅ | GET | `/api/jobs/nearby` | (Legacy radius query) |
| ✅ | POST | `/api/jobs/{id}/requests` | "Request Job" CTA |
| ✅ | GET | `/api/jobs/{id}/requests` | Vendor requests list |
| ✅ | PUT | `/api/jobs/{id}/assign` | Accept vendor |
| ✅ | PUT | `/api/jobs/{id}/status` | Start/Complete buttons |
| ✅ | PUT | `/api/jobs/{id}/cancel` | Cancel job |
| ✅ | PUT | `/api/jobs/{id}/reschedule` | Reschedule |
| ✅ | DELETE | `/api/jobs/{id}/requests/mine` | Withdraw request |
| ✅ | GET | `/api/jobs/vendor/my-requests` | Vendor "My Requests" |

### Payments (`/api/payments`)
| ✅ | Method | Endpoint | UI Screen |
|----|--------|----------|-----------|
| ✅ | POST | `/api/payments/capture` | Confirm & Pay button |

### Vendor Payments (`/api/vendors/stripe`)
| ✅ | Method | Endpoint | UI Screen |
|----|--------|----------|-----------|
| ✅ | POST | `/api/vendors/stripe/onboard` | Stripe setup |
| ✅ | GET | `/api/vendors/stripe/status` | Payout status |
| ✅ | GET | `/api/vendors/stripe/dashboard` | Stripe dashboard link |

### Profiles (`/api/profiles`)
| ✅ | Method | Endpoint | UI Screen |
|----|--------|----------|-----------|
| ✅ | GET | `/api/profiles/vendor/me` | Vendor profile form |
| ✅ | PUT | `/api/profiles/vendor/me` | Update vendor profile |
| ✅ | GET | `/api/profiles/customer/me` | Customer profile form |
| ✅ | PUT | `/api/profiles/customer/me` | Update customer profile |

### Notifications (`/api/notifications`)
| ✅ | Method | Endpoint | UI Screen |
|----|--------|----------|-----------|
| ✅ | GET | `/api/notifications` | Notifications page |
| ✅ | PUT | `/api/notifications/{id}/read` | Mark as read |
| ✅ | GET | `/api/notifications/preferences` | Notification settings |
| ✅ | PUT | `/api/notifications/preferences` | Update preferences |
| ✅ | PUT | `/api/notifications/preferences/unsubscribe-all` | Unsubscribe |
| ✅ | POST | `/api/notifications/devices` | Push token register |
| ✅ | DELETE | `/api/notifications/devices/{id}` | Remove device |

### Ratings (`/api/ratings`)
| ✅ | Method | Endpoint | UI Screen |
|----|--------|----------|-----------|
| ✅ | POST | `/api/ratings` | Submit rating form |

### Disputes (`/api/disputes`)
| ✅ | Method | Endpoint | UI Screen |
|----|--------|----------|-----------|
| ✅ | POST | `/api/disputes` | Raise dispute |

### Compliance (`/api`)
| ✅ | Method | Endpoint | UI Screen |
|----|--------|----------|-----------|
| ✅ | POST | `/api/consent` | Consent record |
| ✅ | GET | `/api/consent` | View consents |
| ✅ | POST | `/api/consent/revoke` | Revoke consent |
| ✅ | POST | `/api/reports` | Abuse report |
| ✅ | POST | `/api/privacy/opt-out` | CCPA opt-out |
| ✅ | POST | `/api/privacy/export` | Data export request |

### Admin (`/api/admin`) — 20 endpoints available (not listed individually)

---

## Missing Endpoints

### GAP-1: Get Ratings for a User (Public Profile)
| Priority | **BLOCKER** |
|----------|------------|
| UI Need | Vendor public profile shows star rating + review list |
| PRD Feature | F11: "Rating visible on vendor's public profile" |
| Current State | `POST /api/ratings` exists (create), but no GET endpoint to list ratings for a user or job |

**Suggested Contract:**
```
GET /api/ratings?revieweeId={userId}&page=1&pageSize=10

Response:
{
  "items": [
    {
      "id": "uuid",
      "jobRequestId": "uuid",
      "reviewerId": "uuid",
      "reviewerName": "Jane D.",
      "score": 5,
      "comment": "Great work, very professional!",
      "createdAt": "2026-06-20T..."
    }
  ],
  "totalCount": 23,
  "averageScore": 4.6
}
```

**Temporary UI Fallback:**
Display `averageRating` from VendorProfile data (already available). Show "Reviews coming soon" placeholder instead of review list.

---

### GAP-2: Get Public Vendor Profile (for Customer to Review)
| Priority | **BLOCKER** |
|----------|------------|
| UI Need | Customer reviewing vendor requests needs to see vendor profile (bio, rating, completed jobs) |
| PRD Feature | F7: "Reviews vendor profile, ratings, and proposed price" |
| Current State | `GET /api/profiles/vendor/me` only returns own profile; no endpoint for viewing another vendor |

**Suggested Contract:**
```
GET /api/profiles/vendor/{vendorProfileId}

Response:
{
  "id": "uuid",
  "businessName": "John's Landscaping",
  "bio": "10 years of experience...",
  "serviceCategories": ["mowing", "hedging"],
  "averageRating": 4.7,
  "totalJobsCompleted": 45,
  "createdAt": "2025-03-15T..."
}
```
Note: Does NOT expose address, insurance docs, or Stripe info.

**Temporary UI Fallback:**
Use the data already in `VendorRequestDto` (vendorName, businessName, averageRating, totalJobsCompleted). Link "View Profile" is disabled with tooltip "Coming soon."

---

### GAP-3: Edit/Update a Job (before assignment)
| Priority | **High** |
|----------|----------|
| UI Need | Customer wants to edit title, description, budget, or photos of an Open job |
| PRD Feature | F4 implies CRUD; only Create exists |
| Current State | `POST /api/jobs` (create), `PUT /api/jobs/{id}/reschedule` (schedule only), `PUT /api/jobs/{id}/cancel` — no general edit |

**Suggested Contract:**
```
PUT /api/jobs/{id}
Body: {
  "title": "Updated title",
  "description": "...",
  "categories": ["mowing"],
  "budgetCents": 5500,
  "photos": ["url1"]
}

Rules: Only allowed when status = Open or Requested (not Assigned+)
Response: 200 OK
```

**Temporary UI Fallback:**
Hide "Edit" button. Customer must cancel and re-create. Show info text: "To change details, cancel this job and post a new one."

---

### GAP-4: Mark All Notifications as Read
| Priority | **High** |
|----------|----------|
| UI Need | "Mark all as read" button in notifications center |
| Current State | Only individual mark-read exists: `PUT /api/notifications/{id}/read` |

**Suggested Contract:**
```
PUT /api/notifications/read-all

Response: { "markedCount": 12 }
```

**Temporary UI Fallback:**
Don't show "Mark all as read" button. Users mark individually (already works).

---

### GAP-5: Payment Intent (Authorize before Capture)
| Priority | **High** |
|----------|----------|
| UI Need | Stripe Elements card form needs a `clientSecret` from PaymentIntent to render |
| PRD Feature | F10: Payment capture with Stripe |
| Current State | `POST /api/payments/capture` does both create + capture in one call. Frontend needs a two-step flow: 1) create intent (get clientSecret), 2) confirm via Stripe.js, 3) capture. |

**Suggested Contract:**
```
POST /api/payments/initiate
Body: { "jobRequestId": "uuid" }

Response: {
  "clientSecret": "pi_xxx_secret_yyy",
  "paymentIntentId": "pi_xxx",
  "amountCents": 5000,
  "platformFeeCents": 750,
  "vendorNetCents": 4250
}
```
Then frontend uses Stripe.js `confirmCardPayment(clientSecret)`, and existing `POST /api/payments/capture` finalizes.

**Temporary UI Fallback:**
Show "Confirm & Pay" button that directly calls `POST /api/payments/capture` (works in test mode without real card). Add TODO note for Stripe Elements integration.

---

### GAP-6: File Upload (presigned URL)
| Priority | **Medium** |
|----------|------------|
| UI Need | Job creation photo upload, vendor insurance doc upload |
| PRD Feature | F4 (photos), F3 (insurance docs) |
| Current State | No upload endpoint. Job creation accepts `photos: string[]` (URLs) |

**Suggested Contract:**
```
POST /api/uploads/presign
Body: { "fileName": "photo.jpg", "contentType": "image/jpeg", "purpose": "job_photo" }

Response: {
  "uploadUrl": "https://s3.../presigned-put-url",
  "fileUrl": "https://cdn.../final-url.jpg",
  "expiresIn": 300
}
```

**Temporary UI Fallback:**
Remove photo upload from job creation form. Add text: "Photo uploads coming soon." The `photos` field is optional in the API, so this doesn't block job creation.

---

### GAP-7: Vendor Public Job History
| Priority | **Medium** |
|----------|------------|
| UI Need | Vendor profile page shows completed job count + thumbnails |
| Current State | `totalJobsCompleted` available in VendorProfile; no job list endpoint for a specific vendor |

**Suggested Contract:**
```
GET /api/profiles/vendor/{id}/jobs?status=Paid&page=1&pageSize=5

Response: PaginatedResult<{ id, title, categories, budgetCents, completedAt }>
```

**Temporary UI Fallback:**
Show `totalJobsCompleted` count only. No list of past jobs.

---

### GAP-8: Get My Disputes (User view)
| Priority | **Low** |
|----------|---------|
| UI Need | User wants to see their open/resolved disputes |
| Current State | `POST /api/disputes` (create) and admin endpoints exist, but no user-facing list |

**Suggested Contract:**
```
GET /api/disputes/mine

Response: [
  {
    "id": "uuid",
    "jobRequestId": "uuid",
    "jobTitle": "Front Yard Mowing",
    "reason": "Work not completed",
    "status": "Open",
    "resolution": null,
    "createdAt": "..."
  }
]
```

**Temporary UI Fallback:**
After raising a dispute, show a static message: "Your dispute has been submitted. Our team will review within 48 hours." No disputes list page.

---

## Implementation Plan for Gaps

### Immediate (before frontend Sprint 5 — Map integration)

| Gap | Action | Effort |
|-----|--------|--------|
| GAP-1 | Add `GET /api/ratings` with reviewee filter | 1h |
| GAP-2 | Add `GET /api/profiles/vendor/{id}` (public, sanitized) | 1h |

### Before Payment UI (Sprint 6)

| Gap | Action | Effort |
|-----|--------|--------|
| GAP-5 | Add `POST /api/payments/initiate` (returns clientSecret) | 2h |

### Before Full Launch

| Gap | Action | Effort |
|-----|--------|--------|
| GAP-3 | Add `PUT /api/jobs/{id}` (edit open jobs) | 2h |
| GAP-4 | Add `PUT /api/notifications/read-all` | 30m |
| GAP-6 | Add presigned upload endpoint | 3h |
| GAP-7 | Add `GET /api/profiles/vendor/{id}/jobs` | 1h |
| GAP-8 | Add `GET /api/disputes/mine` | 1h |

---

## Temporary UI Fallback Matrix

| Screen | Missing Data | Fallback UX | User Impact |
|--------|-------------|-------------|-------------|
| Vendor profile (viewed by customer) | Full profile page | Show summary from VendorRequestDto (name, rating, jobs) | Low — enough info to decide |
| Review list on profile | Rating text list | Show average star + "Reviews coming soon" | Medium — less trust info |
| Job edit | Edit endpoint | "Cancel and re-post" instruction | Low — rare need at MVP |
| Photo upload | Upload endpoint | Text field for URL or hide feature | Medium — no visual content |
| Payment card form | clientSecret | Direct capture button (test mode) | Low — works without card UI in testing |
| Mark all read | Bulk endpoint | Individual mark-read only | Very Low — minor convenience |
| My disputes list | List endpoint | Static "under review" message | Low — few disputes at launch |
| Vendor job history | Job list endpoint | Show count number only | Very Low — stat is sufficient |

---

## Frontend Stubs Implemented

For each blocker/high gap, I've added a fallback component that degrades gracefully:
