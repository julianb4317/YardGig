# Frontend Foundation — Delivery Documentation

## File Tree

```
frontend/
├── .env.example
├── package.json
├── tsconfig.json
├── next.config.ts
├── tailwind.config.ts
├── postcss.config.js
├── FRONTEND_SPEC.md
└── src/
    ├── lib/
    │   ├── api-client.ts          ← Fetch wrapper + JWT + refresh + error handling
    │   ├── auth.ts                ← Token storage (cookies) + user state + logout
    │   └── utils.ts               ← cn(), formatCents()
    ├── components/
    │   ├── providers.tsx           ← TanStack Query provider
    │   ├── layout/
    │   │   ├── header.tsx          ← Sticky header + mobile hamburger + role-based nav
    │   │   └── footer.tsx          ← Footer with legal links
    │   ├── auth/
    │   │   └── auth-guard.tsx      ← Protected route wrapper (redirect + role check)
    │   └── ui/
    │       ├── spinner.tsx         ← Loading spinner + page loader
    │       ├── error-state.tsx     ← Error display + retry button
    │       └── empty-state.tsx     ← Empty list display
    └── app/
        ├── globals.css
        ├── layout.tsx              ← Root layout (Providers + Header + Footer + Toaster)
        ├── page.tsx                ← Landing page
        ├── error.tsx               ← Global error boundary
        ├── not-found.tsx           ← 404 page
        ├── unauthorized/page.tsx   ← 403 page
        ├── auth/
        │   ├── login/page.tsx      ← Email/password + MFA flow
        │   ├── register/page.tsx   ← Registration with role selector
        │   ├── forgot-password/page.tsx
        │   └── reset-password/page.tsx
        └── dashboard/
            ├── customer/page.tsx   ← Protected (Customer role) — placeholder
            └── vendor/page.tsx     ← Protected (Vendor role) — placeholder
```

---

## Implemented Routes

| Route | Page | Auth | Role | Status |
|-------|------|------|------|--------|
| `/` | Landing | Public | — | ✅ |
| `/auth/login` | Login form | Public | — | ✅ |
| `/auth/register` | Registration + role select | Public | — | ✅ |
| `/auth/forgot-password` | Request password reset | Public | — | ✅ |
| `/auth/reset-password` | Set new password (with token) | Public | — | ✅ |
| `/dashboard/customer` | Customer jobs list | Protected | Customer | ✅ (placeholder) |
| `/dashboard/vendor` | Vendor map discovery | Protected | Vendor | ✅ (placeholder) |
| `/unauthorized` | Access denied | Public | — | ✅ |
| `/not-found` | 404 | Public | — | ✅ |

---

## Auth Flow Sequence Diagram

```
┌──────────┐      ┌──────────┐      ┌──────────────────┐
│  Browser │      │  Next.js │      │ ASP.NET Core API │
└────┬─────┘      └────┬─────┘      └────────┬─────────┘
     │                  │                      │
     │ 1. Fill login form                      │
     │─────────────────▶│                      │
     │                  │ 2. POST /api/auth/login
     │                  │─────────────────────▶│
     │                  │                      │ 3. Validate credentials
     │                  │                      │    Check lockout, email verified
     │                  │◀─────────────────────│
     │                  │ 4a. { requiresMfa }  │  (if MFA enabled)
     │◀─────────────────│                      │
     │ Show MFA input   │                      │
     │                  │                      │
     │ 5. Submit with mfaCode                  │
     │─────────────────▶│ POST /api/auth/login │
     │                  │─────────────────────▶│
     │                  │◀─────────────────────│
     │                  │ 6. { accessToken,    │
     │                  │      refreshToken,   │
     │                  │      userId, roles } │
     │                  │                      │
     │ 7. Store tokens in cookies              │
     │    (yg_access, yg_refresh, yg_roles)    │
     │◀─────────────────│                      │
     │                  │                      │
     │ 8. Redirect to role-based dashboard     │
     │    Customer → /dashboard/customer       │
     │    Vendor → /dashboard/vendor           │
     │                  │                      │
     ═══ Token Refresh Flow ═══                │
     │                  │                      │
     │ 9. API call with expired token          │
     │─────────────────▶│─────────────────────▶│
     │                  │◀───── 401 ───────────│
     │                  │                      │
     │                  │ 10. POST /api/auth/refresh
     │                  │     { refreshToken } │
     │                  │─────────────────────▶│
     │                  │◀─────────────────────│
     │                  │ 11. { accessToken }  │
     │                  │                      │
     │                  │ 12. Retry original request
     │                  │─────────────────────▶│
     │                  │◀─────────────────────│
     │◀─────────────────│ 13. Success          │
     │                  │                      │
     ═══ Logout Flow ═══                       │
     │                  │                      │
     │ 14. Click Logout │                      │
     │─────────────────▶│ POST /api/auth/revoke│
     │                  │─────────────────────▶│
     │                  │                      │ Invalidate refresh token
     │ 15. Clear cookies│                      │
     │ 16. Redirect → /auth/login              │
```

---

## Backend Endpoint Mapping

| Frontend Action | Method | Backend Endpoint | Request Body | Response |
|----------------|--------|-----------------|-------------|----------|
| Login | POST | `/api/auth/login` | `{ email, password, mfaCode? }` | `{ accessToken, refreshToken, expiresAt, userId, roles }` or `{ requiresMfa }` or `{ requiresEmailVerification }` |
| Register | POST | `/api/auth/register` | `{ email, password, displayName, roles[] }` | `{ userId, roles, message }` |
| Google Login | POST | `/api/auth/google` | `{ idToken, roles[]? }` | Same as login success |
| Forgot Password | POST | `/api/auth/forgot-password` | `{ email }` | `{ message }` |
| Reset Password | POST | `/api/auth/reset-password` | `{ email, token, newPassword }` | `{ message }` |
| Confirm Email | POST | `/api/auth/confirm-email` | `{ userId, token }` | `{ message }` |
| Resend Confirmation | POST | `/api/auth/resend-confirmation` | `{ email }` | `{ message }` |
| Refresh Token | POST | `/api/auth/refresh` | `{ refreshToken }` | `{ accessToken }` |
| Revoke (Logout) | POST | `/api/auth/revoke` | `{ refreshToken }` | `{ message }` |
| MFA Setup | GET | `/api/auth/mfa/setup` | — | `{ sharedKey, qrCodeUri }` |
| MFA Verify | POST | `/api/auth/mfa/verify` | `{ code }` | `{ message, accessToken }` |

---

## Backend Gaps

| Gap | Description | Recommendation |
|-----|-------------|---------------|
| None identified | All auth endpoints needed for this phase exist in `AuthController.cs` | — |

All endpoints listed above are verified present in the Swagger definition at `http://localhost:5209/swagger`.

---

## Design Decisions

1. **Token storage:** HttpOnly cookies not used because JWT must be sent in `Authorization` header for the API (not cookie-based auth). Tokens stored in JS-accessible cookies with `SameSite=Strict`. Acceptable tradeoff for SPA architecture.

2. **Token refresh:** Handled transparently in `api-client.ts`. On 401 response, the client attempts a refresh and retries the original request once. If refresh fails, redirects to login.

3. **Role-based navigation:** Header dynamically shows links based on roles from cookie. AuthGuard component handles route-level protection with redirect.

4. **Form validation:** Zod schemas match backend validation rules (email format, 12-char password). Server errors are also displayed via toast.

5. **Loading/Error/Empty states:** Every async view uses TanStack Query's `isPending`, `isError`, `data` states mapped to `<Spinner>`, `<ErrorState>`, `<EmptyState>` components.
