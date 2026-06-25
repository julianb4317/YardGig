# Frontend Code Audit Report

## Verdict: **PASS with 3 required fixes + 8 optional improvements**

---

## Required Changes (Must Fix Before Merge)

### R1: Login page uses `any` type — violates strict typing rule

**File:** `src/app/auth/login/page.tsx` line 37  
**Issue:** `apiClient<any>("/api/auth/login", ...)` — the only `any` in the codebase, bypassing type safety on the login response.

**Fix:**
```typescript
// Replace:
apiClient<any>("/api/auth/login", { method: "POST", body: data, skipAuth: true }),

// With:
import type { LoginResponse } from "@/lib/types";
apiClient<LoginResponse>("/api/auth/login", { method: "POST", body: data, skipAuth: true }),
```

**Risk:** Low runtime risk (works today), but defeats the purpose of the strict types we defined.

---

### R2: Cancel job success handler has a bug — incorrect data access

**File:** `src/components/jobs/job-actions.tsx` line 45  
**Issue:** `(data.penaltyApplied as any).penaltyCents / 100` — `penaltyApplied` is a `boolean`, not an object with `penaltyCents`. The toast message will show `NaN`.

**Fix:**
```typescript
// The cancelJob API returns { message, penaltyApplied: boolean, penaltyCents: number }
// But our lib/api/jobs.ts types it as { message: string; penaltyApplied: boolean }
// Need to update the return type AND fix the handler:

// In lib/api/jobs.ts, update return type:
export function cancelJob(jobId: string, reason?: string) {
  return apiClient<{ message: string; penaltyApplied: boolean; penaltyCents: number }>(`/api/jobs/${jobId}/cancel`, {
    method: "PUT",
    body: { reason },
  });
}

// In job-actions.tsx, fix the toast:
onSuccess: (data) => {
  setCancelOpen(false);
  toast.success(data.penaltyApplied 
    ? `Cancelled (late-cancel fee: $${(data.penaltyCents / 100).toFixed(2)})` 
    : "Job cancelled.");
  invalidate();
},
```

**Risk:** Broken UX — user sees "Cancelled (late-cancel fee: $NaN)" on late cancellations.

---

### R3: ConfirmDialog missing keyboard trap — Escape key doesn't close

**File:** `src/components/ui/confirm-dialog.tsx`  
**Issue:** No `onKeyDown` handler for Escape key. Users relying on keyboard can't dismiss the dialog without clicking outside (which is mouse-only for screen reader users).

**Fix:** Add `useEffect` for Escape key:
```typescript
import { useEffect } from "react";

// Inside ConfirmDialog, add:
useEffect(() => {
  if (!open) return;
  const handler = (e: KeyboardEvent) => {
    if (e.key === "Escape") onCancel();
  };
  document.addEventListener("keydown", handler);
  return () => document.removeEventListener("keydown", handler);
}, [open, onCancel]);
```

Also add `role="dialog"` and `aria-modal="true"` to the dialog container:
```html
<div role="dialog" aria-modal="true" aria-labelledby="dialog-title" ...>
```

**Risk:** Accessibility blocker — WCAG 2.1 AA requires modal dialogs to be keyboard-dismissible.

---

## Optional Improvements (Recommended but Non-Blocking)

### O1: `auth.ts` caches stale user object in module variable

**Issue:** `currentUser` is a module-level `let` variable. If the token expires and `clearAuth()` is called in one tab, other components that imported `getUser()` still hold the stale reference until page reload.

**Recommendation:** Use a lightweight reactive store (zustand or a simple `useSyncExternalStore` wrapper) instead of a module variable. Or remove the cache entirely — reading 3 cookies per `getUser()` call is trivially fast.

---

### O2: `AuthGuard` flashes loading spinner on every mount

**Issue:** The guard calls `isAuthenticated()` synchronously (reads cookie) but still renders a spinner while the `useEffect` runs. On fast connections, users see a brief flash.

**Recommendation:** Since `isAuthenticated()` is synchronous, skip the spinner entirely — just render children or redirect immediately without the loading intermediate.

---

### O3: Notification bell polls even when tab is not visible

**Issue:** `refetchInterval: 30_000` fires regardless of tab visibility, creating unnecessary API calls.

**Recommendation:** Add `refetchIntervalInBackground: false` to the query options — TanStack Query supports this natively.

---

### O4: `formatCents` doesn't handle edge cases

**Issue:** `formatCents(0)` returns `$0.00` which is fine, but `formatCents(undefined)` throws. Several places pass `budgetCents` which could theoretically be null from the API.

**Recommendation:** Add a null guard: `export function formatCents(cents: number | null | undefined): string { return cents != null ? \`$\${(cents / 100).toFixed(2)}\` : "$0.00"; }`

---

### O5: Duplicate status color mappings

**Issue:** `STATUS_COLORS` is defined separately in `job-card.tsx` and `jobs/[id]/page.tsx`. If a new status is added, both need updating.

**Recommendation:** Extract to `src/lib/constants.ts` and import in both places.

---

### O6: `api-client.ts` double-refresh race condition

**Issue:** If two 401 responses arrive simultaneously (e.g., two parallel queries fail), both trigger `refreshAccessToken()` independently. The second call may use an already-invalidated refresh token.

**Recommendation:** Add a mutex/dedup:
```typescript
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = doRefresh();
  const result = await refreshPromise;
  refreshPromise = null;
  return result;
}
```

---

### O7: Missing `Secure` flag on token cookies in production

**Issue:** Cookies are set with `{ sameSite: "strict" }` but no `secure: true`. In production over HTTPS, cookies should be marked Secure to prevent transmission over HTTP.

**Recommendation:**
```typescript
const isProduction = process.env.NODE_ENV === "production";
Cookies.set("yg_access", token, { sameSite: "strict", secure: isProduction });
```

---

### O8: Notification type import inconsistency

**Issue:** `NotificationItem` is defined in both `lib/types.ts` AND `lib/api/notifications.ts`. The page imports from `lib/api/notifications.ts` but the shared type file has its own copy.

**Recommendation:** Remove the duplicate from `lib/api/notifications.ts` and import from `lib/types.ts` everywhere.

---

## API Correctness vs Swagger ✅

| Frontend Call | Backend Endpoint | Match? |
|-------------|-----------------|--------|
| `POST /api/auth/login` | AuthController.Login | ✅ |
| `POST /api/auth/register` | AuthController.Register | ✅ |
| `POST /api/auth/forgot-password` | AuthController.ForgotPassword | ✅ |
| `POST /api/auth/reset-password` | AuthController.ResetPassword | ✅ |
| `POST /api/auth/refresh` | AuthController.RefreshToken | ✅ |
| `POST /api/auth/revoke` | AuthController.RevokeToken | ✅ |
| `GET /api/jobs/mine` | JobsController.GetMyJobs | ✅ |
| `GET /api/jobs/map` | JobsController.GetJobsByBounds | ✅ |
| `GET /api/jobs/{id}` | JobsController.GetJobDetail | ✅ |
| `POST /api/jobs` | JobsController.CreateJob | ✅ |
| `PUT /api/jobs/{id}` | JobsController.EditJob | ✅ |
| `POST /api/jobs/{id}/requests` | JobsController.RequestJob | ✅ |
| `GET /api/jobs/{id}/requests` | JobsController.GetJobRequests | ✅ |
| `PUT /api/jobs/{id}/assign` | JobsController.AssignVendor | ✅ |
| `PUT /api/jobs/{id}/status` | JobsController.UpdateStatus | ✅ |
| `PUT /api/jobs/{id}/cancel` | JobsController.CancelJob | ✅ |
| `DELETE /api/jobs/{id}/requests/mine` | JobsController.WithdrawRequest | ✅ |
| `GET /api/jobs/vendor/my-requests` | JobsController.GetVendorMyRequests | ✅ |
| `POST /api/payments/initiate` | PaymentsController.InitiatePayment | ✅ |
| `POST /api/payments/capture` | PaymentsController.CapturePayment | ✅ |
| `GET /api/notifications` | NotificationsController.GetNotifications | ✅ |
| `PUT /api/notifications/{id}/read` | NotificationsController.MarkAsRead | ✅ |
| `PUT /api/notifications/read-all` | NotificationsController.MarkAllAsRead | ✅ |
| `GET /api/notifications/preferences` | NotifPrefsController.GetPreferences | ✅ |
| `PUT /api/notifications/preferences` | NotifPrefsController.UpdatePreferences | ✅ |
| `GET /api/profiles/vendor/me` | ProfilesController.GetMyVendorProfile | ✅ |
| `PUT /api/profiles/vendor/me` | ProfilesController.UpdateVendorProfile | ✅ |
| `GET /api/profiles/customer/me` | ProfilesController.GetMyCustomerProfile | ✅ |
| `PUT /api/profiles/customer/me` | ProfilesController.UpdateCustomerProfile | ✅ |
| `GET /api/profiles/vendor/{id}` | ProfilesController.GetVendorPublicProfile | ✅ |
| `GET /api/ratings` | RatingsController.GetRatings | ✅ |
| `POST /api/ratings` | RatingsController.CreateRating | ✅ |
| `POST /api/disputes` | DisputesController.RaiseDispute | ✅ |
| `GET /api/disputes/mine` | DisputesController.GetMyDisputes | ✅ |
| `POST /api/uploads/presign` | UploadsController.GetPresignedUrl | ✅ |

**All 34 frontend API calls match Swagger endpoints exactly.** No invented endpoints.

---

## Error/Loading/Empty States ✅

| Page/Component | Loading | Error | Empty |
|---------------|---------|-------|-------|
| Customer Dashboard | ✅ JobListSkeleton | ✅ ErrorState + retry | ✅ EmptyState + CTA |
| Vendor Browse | ✅ JobListSkeleton | ✅ ErrorState + retry | ✅ EmptyState |
| Job Detail | ✅ PageLoader | ✅ ErrorState | N/A (404 handled) |
| Create Job | N/A (form) | ✅ Toast on mutation error | N/A |
| Vendor Requests | ✅ PageLoader | ✅ ErrorState + retry | ✅ EmptyState |
| My Requests (vendor) | ✅ PageLoader | ✅ ErrorState + retry | ✅ EmptyState + CTA |
| Notifications | ✅ PageLoader | ✅ ErrorState + retry | ✅ EmptyState |
| Settings/Profile | ✅ Spinner | ✅ ErrorState + retry | N/A (form) |

**All async views have all 3 states.** ✅

---

## Security Assessment

| Check | Status | Notes |
|-------|--------|-------|
| No secrets in client code | ✅ | Only `NEXT_PUBLIC_*` env vars |
| Tokens not in localStorage | ✅ | Stored in cookies (JS-accessible but SameSite=strict) |
| Auth on protected routes | ✅ | AuthGuard component on every protected page |
| Server-side validation | ✅ | Zod on frontend + FluentValidation on backend (defense in depth) |
| XSS via user content | ✅ | React auto-escapes; no `dangerouslySetInnerHTML` |
| CSRF protection | ✅ | Bearer token auth (not cookie-sent) = no CSRF vector |
| Refresh token rotation | ⚠️ | Backend rotates via SecurityStamp but doesn't issue new refresh token (acceptable for MVP) |
| Rate limit awareness | ✅ | Global 429 handler in QueryClient |

**No critical security issues.** O7 (Secure cookie flag) is a recommended improvement for production.

---

## Summary

| Category | Verdict |
|----------|---------|
| Phase scope adherence | ✅ All implemented features match plan |
| API correctness | ✅ 34/34 endpoints match Swagger |
| Error/loading/empty states | ✅ All async views covered |
| Accessibility | ⚠️ R3 required (Escape key on modal) |
| Security | ✅ No blockers; O7 recommended |
| Reusability | ⚠️ O5 — minor duplication of STATUS_COLORS |
| Type safety | ⚠️ R1 — one `any` to fix |
| Runtime bugs | ❌ R2 — cancel toast shows NaN |
