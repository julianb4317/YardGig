# Phase 3 Delivery — Transactional Workflows

## State Machines

### Job Lifecycle (Customer View)

```
  [Open] ──── Cancel ──── [Cancelled]
    │
    ▼ (vendor requests)
  [Requested] ──── Cancel ──── [Cancelled]
    │
    ▼ (accept vendor)
  [Assigned] ──── Cancel ──── [Cancelled]
    │
    ▼ (vendor starts — no customer action)
  [InProgress]
    │
    ▼ (vendor completes — no customer action)
  [Completed] ──── Confirm & Pay ──── [Paid] ──── [Closed]
```

**Customer actions:** Cancel (Open/Requested/Assigned), Accept Vendor (Requested), Confirm Pay (Completed)

### Job Lifecycle (Vendor View)

```
  See job on map
    │
    ▼ (Request Job)
  [Pending Request] ──── Withdraw ──── [Withdrawn]
    │
    ▼ (customer accepts)
  [Assigned to me]
    │
    ▼ (Start Work)
  [InProgress]
    │
    ▼ (Mark Completed)
  [Completed] → waiting for customer payment
```

**Vendor actions:** Request Job, Withdraw Request, Start Work (Assigned), Mark Completed (InProgress)

### Vendor Request State Machine

```
  [Pending] ──── Customer accepts ──── [Accepted]
    │                                      │
    ├──── Customer accepts other ──── [Rejected]
    │
    ├──── Customer cancels job ──── [Rejected]
    │
    └──── Vendor withdraws ──── [Withdrawn]
```

---

## Endpoint-to-Action Matrix

| UI Action | Trigger | Method | Endpoint | Confirm? | Role |
|-----------|---------|--------|----------|----------|------|
| Request job | "Send Request" button | POST | `/api/jobs/{id}/requests` | No (dialog already has fields) | Vendor |
| Withdraw request | "Withdraw" button | DELETE | `/api/jobs/{id}/requests/mine` | ✅ Confirm dialog | Vendor |
| Accept vendor | "Accept Vendor" button | PUT | `/api/jobs/{id}/assign` | ✅ Confirm dialog | Customer |
| Start work | "Start Work" button | PUT | `/api/jobs/{id}/status` `{status:"InProgress"}` | No | Vendor |
| Mark completed | "Mark Completed" button | PUT | `/api/jobs/{id}/status` `{status:"Completed"}` | No | Vendor |
| Cancel job | "Cancel Job" button | PUT | `/api/jobs/{id}/cancel` | ✅ Confirm dialog (danger) | Customer |
| Confirm & pay | "Confirm & Pay" button | POST | `/api/payments/capture` | Separate flow (Sprint 5+) | Customer |
| View my requests | Nav link | GET | `/api/jobs/vendor/my-requests` | — | Vendor |
| View vendor requests | Button on job detail | GET | `/api/jobs/{id}/requests` | — | Customer |

---

## Error-Handling Matrix

| Error Scenario | HTTP Status | User-Facing Message | UI Behavior |
|---------------|-------------|-------------------|-------------|
| Job already assigned | 400 | "Job is no longer open for requests." | Toast error; remove pin / update card |
| Duplicate request | 400 | "You have already requested this job." | Toast; disable Request button |
| Vendor not verified | 400 | "Vendor must be verified to request jobs." | Toast; redirect to profile setup |
| Job not cancellable | 400 | "Cannot cancel a job that is in progress." | Toast; button stays enabled (user can try dispute) |
| Invalid status transition | 400 | "Cannot transition from X to Y." | Toast; refetch job detail to sync UI |
| Not job owner | 400 | "Only the job owner can assign/cancel." | Toast; should never happen if auth correct |
| Vendor request not found | 400 | "Vendor request not found." | Toast; refetch request list |
| Network timeout | — | "Request failed. Please try again." | Toast; button re-enabled |
| 401 Unauthorized | 401 | (silent) | Auto-redirect to login |
| 403 Forbidden | 403 | (silent) | Redirect to /unauthorized |
| 429 Rate limited | 429 | "Too many requests. Wait a moment." | Toast; button disabled for 5s |

---

## Backend Gaps (Resolved)

| Gap | Endpoint Added | Resolution |
|-----|---------------|-----------|
| Vendor can't see all their requests across jobs | `GET /api/jobs/vendor/my-requests` | Added `GetVendorMyRequestsQuery` + handler + endpoint |

Both gaps from Phase 2 (`GET /api/jobs/mine`) and Phase 3 (`GET /api/jobs/vendor/my-requests`) have been implemented and the backend builds cleanly.

---

## New Routes

| Route | Page | Role | Description |
|-------|------|------|-------------|
| `/jobs/[id]/requests` | Vendor Requests | Customer | Review vendor requests, accept one |
| `/dashboard/vendor/requests` | My Requests | Vendor | All requests with status, withdraw action |

---

## New/Updated Components

| Component | File | Purpose |
|-----------|------|---------|
| `ConfirmDialog` | `components/ui/confirm-dialog.tsx` | Reusable confirmation modal with danger variant |
| `JobActions` | `components/jobs/job-actions.tsx` | Status transition buttons (Start, Complete, Cancel) |
| `RequestJobDialog` | `components/jobs/request-job-dialog.tsx` | Vendor request modal (price + note) |
| `VendorRequestCard` | `app/jobs/[id]/requests/page.tsx` | Individual vendor request with Accept button |
| Header (updated) | `components/layout/header.tsx` | Added "My Requests" nav link for vendors |
| Job Detail (updated) | `app/jobs/[id]/page.tsx` | Integrated `JobActions` component |

---

## Idempotency & Double-Submit Prevention

| Action | Method |
|--------|--------|
| Request Job | `mutation.isPending` disables button + shows spinner |
| Withdraw | Confirm dialog's confirm button shows "Processing..." while pending |
| Accept Vendor | Confirm dialog's confirm button disabled during mutation |
| Start/Complete | Button disabled during `statusMutation.isPending` |
| Cancel | Confirm dialog prevents double-click |
| All mutations | TanStack Query `retry: 0` prevents automatic retry on mutations |

---

## Manual Test Checklist

### Vendor Request Flow
- [ ] "Send Request" dialog opens from vendor browse / job detail
- [ ] Request with price + note succeeds; toast confirms
- [ ] Request without optional fields succeeds
- [ ] Duplicate request shows error toast
- [ ] Unverified vendor gets clear error
- [ ] Dialog closes on success; button state updates

### Customer Accept/Reject Flow
- [ ] `/jobs/{id}/requests` shows all vendor requests with profile info
- [ ] "Accept Vendor" shows confirmation dialog
- [ ] After accept: redirect to job detail; status = Assigned
- [ ] Rejected vendors marked with gray status badge
- [ ] Empty state when no requests

### Vendor Withdraw
- [ ] "Withdraw" button shows on Pending requests only
- [ ] Confirmation dialog appears
- [ ] After withdraw: request disappears from list
- [ ] Cannot re-request same job

### Job Status Actions
- [ ] "Start Work" visible only for Assigned jobs (vendor)
- [ ] "Mark Completed" visible only for InProgress (vendor)
- [ ] "Cancel Job" visible for Open/Requested/Assigned (customer)
- [ ] Cancel confirmation includes late-fee warning
- [ ] Buttons disable during API call (no double-submit)
- [ ] Stale status (e.g., job was just assigned elsewhere) shows error toast

### My Requests Page (Vendor)
- [ ] Lists all vendor requests with status badges
- [ ] "Pending" requests show Withdraw button
- [ ] "Accepted" requests link to job detail
- [ ] "Rejected" requests shown but no actions
- [ ] Empty state with link to browse jobs
