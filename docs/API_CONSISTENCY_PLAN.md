# API Consistency Remediation Plan — Rakr

## Overview

This document outlines all changes needed to standardize the API response contract across the Rakr backend, making it mobile-client-ready. Currently there are 6 different error response formats and 5 different success response patterns. This plan normalizes everything to a single predictable contract.

---

## Target Standard

| Concern | Standard |
|---------|----------|
| Error responses | Always `{ "errors": ["message1", "message2"] }` (array, wrapped in object) |
| Success responses (mutations) | `{ "data": {...} }` or the relevant resource fields |
| Success responses (queries) | The resource/list directly |
| HTTP 200 | Success with data (never empty body) |
| HTTP 201 | Resource created |
| HTTP 400 | Validation / business rule failure |
| HTTP 401 | Not authenticated |
| HTTP 403 | Not authorized |
| HTTP 404 | Resource not found |
| HTTP 500 | Server error (generic message only — details logged server-side) |

---

## Current State: Error Format Audit

### Pattern A: `{ errors: string[] }` — CORRECT (keep as-is)
Used by: AuthController, UploadsController, MessagesController, JobsController (some), PaymentsController (some)

### Pattern B: `{ error: string, rootCause: string }` — REMOVE
Used by:
- JobsController.CreateJob — `StatusCode(500, new { error = ex.Message, rootCause = inner.Message })`
- JobsController.AssignVendor — same
- JobsController.UpdateStatus — same
- PaymentsController.ChargeForJob — same

### Pattern C: `{ error: string, innerError: string }` — REMOVE
Used by:
- AuthController.Register — `StatusCode(500, new { error = ex.Message, innerError = ex.InnerException?.Message })`

### Pattern D: Raw `result.Errors` without wrapping — FIX
Used by 8 endpoints that pass `BadRequest(result.Errors)` or `NotFound(result.Errors)` — sends a bare array at root level instead of `{ errors: [...] }`

### Pattern E: Plain string in BadRequest — FIX
Used by 5 endpoints that pass `BadRequest("string message")` — breaks JSON parsing entirely

### Pattern F: `{ error: string }` (singular key) — FIX
Used by RecurringJobsController (Pause, Resume, Cancel) — `BadRequest(new { error = "..." })`

---

## Phase 1: Backend Error Format Standardization

### 1.1 Fix Pattern D — Raw `result.Errors` (8 endpoints)

| Controller | Endpoint | Current Code | Fixed Code |
|---|---|---|---|
| JobsController | `GET {id}` (NotFound) | `NotFound(result.Errors)` | `NotFound(new { errors = result.Errors })` |
| JobsController | `PUT {id}` (EditJob) | `BadRequest(result.Errors)` | `BadRequest(new { errors = result.Errors })` |
| JobsController | `POST {id}/requests` | `BadRequest(result.Errors)` | `BadRequest(new { errors = result.Errors })` |
| JobsController | `PUT {id}/cancel` | `BadRequest(result.Errors)` | `BadRequest(new { errors = result.Errors })` |
| JobsController | `PUT {id}/reschedule` | `BadRequest(result.Errors)` | `BadRequest(new { errors = result.Errors })` |
| JobsController | `GET {id}/requests` | `BadRequest(result.Errors)` | `BadRequest(new { errors = result.Errors })` |
| JobsController | `DELETE {id}/requests/mine` | `BadRequest(result.Errors)` | `BadRequest(new { errors = result.Errors })` |
| RatingsController | `POST` | `BadRequest(result.Errors)` | `BadRequest(new { errors = result.Errors })` |

### 1.2 Fix Pattern E — Plain string BadRequest (5 endpoints)

| Controller | Endpoint | Current Code | Fixed Code |
|---|---|---|---|
| DisputesController | `POST` (wrong status) | `BadRequest("Can only dispute...")` | `BadRequest(new { errors = new[] { "Can only dispute completed or paid jobs." } })` |
| DisputesController | `POST` (duplicate) | `BadRequest("A dispute already exists...")` | `BadRequest(new { errors = new[] { "A dispute already exists for this job." } })` |
| ComplianceController | `POST consent/revoke` | `BadRequest("This consent cannot...")` | `BadRequest(new { errors = new[] { "This consent cannot be revoked. To withdraw, please delete your account." } })` |
| VendorPaymentsController | `GET dashboard` | `BadRequest("Stripe account not set up.")` | `BadRequest(new { errors = new[] { "Stripe account not set up." } })` |
| AdminController | `PUT finance/payouts/{id}/retry` | `BadRequest("Only failed payouts can be retried.")` | `BadRequest(new { errors = new[] { "Only failed payouts can be retried." } })` |

### 1.3 Fix Pattern F — Singular `{ error }` (3 endpoints)

| Controller | Endpoint | Current Code | Fixed Code |
|---|---|---|---|
| RecurringJobsController | `PUT {id}/pause` | `new { error = "..." }` | `new { errors = new[] { "Only active series can be paused." } }` |
| RecurringJobsController | `PUT {id}/resume` | `new { error = "..." }` | `new { errors = new[] { "Only paused or payment-required series can be resumed." } }` |
| RecurringJobsController | `PUT {id}/resume` (no card) | `new { error = "..." }` | `new { errors = new[] { "Add a payment method before resuming." } }` |
| RecurringJobsController | `PUT {id}/cancel` | `new { error = "..." }` | `new { errors = new[] { "Series is already cancelled." } }` |

### 1.4 Fix Patterns B & C — Debug error shapes (5 endpoints)

Replace scattered try/catch with generic user-facing messages. Log details server-side.

| Controller | Endpoint | Current Response | Fixed Response |
|---|---|---|---|
| JobsController | `POST` (CreateJob) | `{ error, rootCause }` | `{ errors = new[] { "Failed to create job. Please try again." } }` |
| JobsController | `PUT {id}/assign` | `{ error, rootCause }` | `{ errors = new[] { "Failed to assign vendor." } }` |
| JobsController | `PUT {id}/status` | `{ error, rootCause }` | `{ errors = new[] { "Failed to update status." } }` |
| PaymentsController | `POST charge` | `{ error, rootCause }` | `{ errors = new[] { "Payment processing failed. Please try again." } }` |
| AuthController | `POST register` | `{ error, innerError }` | `{ errors = new[] { "Registration failed. Please try again." } }` |

In each case, keep `logger.LogError(ex, ...)` before returning the response.

---

## Phase 2: Backend Success Response Standardization

### 2.1 Fix empty 200 bodies (3 endpoints)

| Controller | Endpoint | Current | Fixed |
|---|---|---|---|
| ProfilesController | `PUT vendor/me` | `return Ok();` | `return Ok(new { success = true });` |
| ProfilesController | `PUT customer/me` | `return Ok();` | `return Ok(new { success = true });` |
| JobsController | `PUT {id}` (EditJob success) | `return Ok();` (from ternary) | `return Ok(new { success = true });` |

### 2.2 Current success patterns (keep as-is — all work correctly)

| Pattern | Examples | Status |
|---|---|---|
| `{ id }` or `{ xyzId }` | CreateJob, RaiseDispute, SendMessage | ✅ Keep |
| `{ message }` | AssignVendor, CancelJob, RemovePaymentMethod | ✅ Keep |
| `{ status }` | UpdateStatus, PauseSeries, ResumeSeries | ✅ Keep |
| `{ success: true }` | MarkAsRead, WithdrawFromSeries | ✅ Keep |
| `{ markedCount }` | MarkAllAsRead | ✅ Keep |
| Complex objects | ChargeForJob, Login, Register | ✅ Keep |
| Direct resource data | GetNotifications, GetMessages, GetMyJobs | ✅ Keep |

---

## Phase 3: Remove Dead Frontend Code

### 3.1 Remove unused API functions

File: `frontend/src/lib/api/payments.ts`

Remove `initiatePayment()` and `capturePayment()` — these call `/api/payments/initiate` and `/api/payments/capture` which do not exist. They are dead code from an older payment flow. The actual payment endpoint is `/api/payments/charge` which is called directly from `payment-button.tsx`.

### 3.2 Simplify `frontend/src/lib/api-client.ts` error parsing

**Before** (multi-fallback):
```typescript
const errors: string[] = errorBody.errors
  ?? [errorBody.error ?? `Request failed with ${res.status}`];
if (errorBody.innerError) {
  errors.push(errorBody.innerError);
}
if (errorBody.rootCause && errorBody.rootCause !== errors[0]) {
  errors.push(errorBody.rootCause);
}
```

**After** (clean):
```typescript
const errors: string[] = errorBody.errors ?? [`Request failed with ${res.status}`];
```

The `innerError`, `rootCause`, and singular `error` fallbacks become unnecessary once Phase 1 is complete.

---

## Phase 4: Add Global Exception Filter (Backend)

Instead of scattered try/catch blocks in 5 controllers, add a single exception filter:

### 4.1 Create the filter

```csharp
// src/Rakr.Api/Filters/GlobalExceptionFilter.cs
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace Rakr.Api.Filters;

public class GlobalExceptionFilter(ILogger<GlobalExceptionFilter> logger) : IExceptionFilter
{
    public void OnException(ExceptionContext context)
    {
        var ex = context.Exception;
        var inner = ex;
        while (inner.InnerException != null) inner = inner.InnerException;

        logger.LogError(ex, "Unhandled exception in {Controller}/{Action}: {RootCause}",
            context.RouteData.Values["controller"],
            context.RouteData.Values["action"],
            inner.Message);

        context.Result = new ObjectResult(new { errors = new[] { "An unexpected error occurred. Please try again." } })
        {
            StatusCode = 500
        };
        context.ExceptionHandled = true;
    }
}
```

### 4.2 Register in Program.cs

```csharp
builder.Services.AddControllers(options =>
{
    options.Filters.Add<Rakr.Api.Filters.GlobalExceptionFilter>();
});
```

### 4.3 Remove individual try/catch blocks

After the filter is in place, remove try/catch from:
- JobsController.CreateJob
- JobsController.AssignVendor
- JobsController.UpdateStatus
- PaymentsController.ChargeForJob
- AuthController.Register

The only exception: `JobsController.GetMyJobs` which intentionally catches to return an empty result for new users — keep that one.

---

## Phase 5: Frontend Type Safety

After backend is standardized, add explicit return types to all mutation API functions:

```typescript
// frontend/src/lib/api/jobs.ts
export function assignVendor(jobId: string, vendorRequestId: string) {
  return apiClient<{ message: string }>(`/api/jobs/${jobId}/assign`, { method: "PUT", body: { vendorRequestId } });
}

export function updateJobStatus(jobId: string, status: string, completionPhotos?: string[]) {
  return apiClient<{ status: string }>(`/api/jobs/${jobId}/status`, { method: "PUT", body: { status, completionPhotos } });
}

export function updateVendorProfile(data: {...}) {
  return apiClient<{ success: boolean }>("/api/profiles/vendor/me", { method: "PUT", body: data });
}

export function updateCustomerProfile(data: {...}) {
  return apiClient<{ success: boolean }>("/api/profiles/customer/me", { method: "PUT", body: data });
}
```

---

## Execution Order

| Step | Phase | Risk | Backwards Compatible |
|------|-------|------|---------------------|
| 1 | Phase 1 (fix backend errors) | Zero | Yes — frontend fallback handles `{ errors }` already |
| 2 | Phase 2 (fix empty bodies) | Zero | Yes — adding body to empty 200 is additive |
| 3 | Phase 4 (global exception filter) | Low | Yes — same behavior, centralized |
| 4 | Phase 3 (frontend cleanup) | Low | Yes — removing dead code only |
| 5 | Phase 5 (type safety) | Zero | Yes — adding TypeScript types only |

---

## Verification Checklist

After each phase, verify:

- [ ] `dotnet build` passes with 0 errors
- [ ] Frontend TypeScript has 0 diagnostics
- [ ] All existing toast error messages still display correctly
- [ ] Payment flow still works (charge → rating)
- [ ] Job lifecycle (create → request → assign → start → complete → pay) works
- [ ] Recurring job creation works
- [ ] Profile update works (both customer and vendor)
- [ ] Notification mark-as-read works

---

## Prompt for Next Session

> Standardize the Rakr API response contract following the plan in `docs/API_CONSISTENCY_PLAN.md`. Execute phases 1 through 5 in order. All error responses must return `{ errors: string[] }`. All empty 200 bodies must return `{ success: true }`. Remove debug info from error responses (log server-side instead). Add a global exception filter. Then simplify the frontend apiClient error parsing and remove dead payment API functions. No logic changes — just response format consistency. Verify the build passes after each phase.
