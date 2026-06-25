# Phase 5 Delivery — Hardening, Polish & Release Readiness

## Definition of Done Checklist

### Code Quality
- [x] No `any` types in API integration layer (`lib/types.ts` fully typed)
- [x] All API responses have corresponding TypeScript interfaces
- [x] Enums match backend exactly (`JobStatus`, `VendorRequestStatus`, `VerificationStatus`)
- [x] `ApiError` class provides structured error access
- [x] ESLint configured (via `eslint-config-next`)
- [x] Consistent naming: camelCase props, PascalCase components

### Error Handling
- [x] Global `error.tsx` — catches unhandled exceptions with retry + go-home
- [x] `not-found.tsx` — user-friendly 404 with navigation options
- [x] `unauthorized/page.tsx` — 403 access denied
- [x] All queries handle `isLoading`, `isError` states
- [x] All mutations handle `onError` with toast
- [x] Network errors surface as user-friendly messages
- [x] 401 → automatic token refresh → retry → login redirect
- [x] 429 → "Too many requests" toast (global mutation handler)

### Performance
- [x] `output: "standalone"` — minimal production build for Docker
- [x] Static assets: `Cache-Control: max-age=31536000, immutable`
- [x] TanStack Query: `staleTime: 30s`, `gcTime: 5min`
- [x] No retry on 401/403/404 (useless retries eliminated)
- [x] Notifications poll at 30s interval (not continuous)
- [x] Images configured for remote optimization
- [x] Next.js automatic code splitting per route

### Security
- [x] `X-Content-Type-Options: nosniff` header
- [x] `X-Frame-Options: DENY` header
- [x] `Referrer-Policy: strict-origin-when-cross-origin`
- [x] Tokens in cookies with `SameSite: strict`
- [x] No secrets in client code (only `NEXT_PUBLIC_*` vars)
- [x] Auth guard redirects on every protected route
- [x] Form inputs sanitized via Zod schemas

### Accessibility
- [x] All interactive elements keyboard reachable (Tab/Enter/Space)
- [x] All form inputs have associated `<label>` via `htmlFor`
- [x] Tab panels use `role="tablist"` / `role="tab"` / `aria-selected`
- [x] Lists use `role="list"` / `role="listitem"`
- [x] Buttons have text content or `aria-label`
- [x] Icons are `aria-hidden="true"` (decorative)
- [x] Color is never the sole status indicator (icons + text accompany)
- [x] Focus visible on all interactive elements (browser default)
- [x] Modal dialogs trap focus within (click-outside and Escape close)
- [x] Error alerts use `role="alert"` for screen reader announcement

### Responsive Design
- [x] All pages tested at 375px (mobile) through 1440px (desktop)
- [x] Header collapses to hamburger menu on mobile
- [x] Forms stack vertically on mobile
- [x] Job cards are full-width on mobile, compact on desktop
- [x] Filter panels are toggleable on mobile (not always visible)
- [x] Tables not used (cards/lists adapt to width)

### Testing
- [x] Vitest configured with path aliases
- [x] Auth module unit tests (setAuth, getUser, clearAuth, isAuthenticated, hasRole)
- [x] API client unit tests (header injection, error handling, skipAuth, 204)
- [x] Test script in package.json: `npm test`
- [ ] Integration tests with Playwright (post-MVP — requires running API)
- [ ] Visual regression tests (post-MVP)

### Deployment
- [x] Production Dockerfile (multi-stage, non-root, standalone output)
- [x] `.env.example` with all required variables
- [x] `next.config.ts` optimized for production
- [x] Backend CORS allows frontend origin

---

## Known Limitations

| # | Limitation | Impact | Workaround |
|---|-----------|--------|-----------|
| 1 | **No Google Maps integration** (Sprint 5 in plan) | Vendor uses list view instead of map | List view fetches same API; map is additive UI |
| 2 | **No real-time updates** (SignalR not connected in frontend) | Notifications rely on 30s polling | Acceptable for MVP; no missed data, just delayed |
| 3 | **No Stripe payment UI** (Elements not integrated) | Payment capture endpoint exists but no card input | Backend handles payment; frontend needs Stripe.js in next phase |
| 4 | **No direct messaging between users** | Users can only communicate via request notes | Intentional MVP scoping per PRD |
| 5 | **Token in JS-accessible cookies** | XSS could steal tokens | `SameSite=Strict` mitigates CSRF; CSP headers mitigate XSS; acceptable for SPA |
| 6 | **No image upload UI** | Job photos field accepts URLs only | Needs S3 presigned upload flow in next phase |
| 7 | **No email confirmation UI** | User told to check email; no in-app code entry | Confirmation link in email works; in-app UX is nice-to-have |
| 8 | **Vendor profile insurance doc** | Accepts URL string, no file upload | Same as #6 — needs upload component |
| 9 | **No admin frontend** | Admin endpoints exist but no UI | Admin uses Swagger or builds later (Sprint 7 in plan) |
| 10 | **No offline support** | App requires network connection | Standard for MVP marketplace |

---

## Post-MVP Backlog Recommendations

### High Priority (Next Sprint)

| # | Feature | Effort | Value |
|---|---------|--------|-------|
| 1 | **Google Maps integration** (vendor map view with pins, clustering, real-time) | Large | Critical for vendor UX |
| 2 | **Stripe Elements** payment form + confirmation flow | Medium | Enables actual payments |
| 3 | **File upload** (presigned S3 URLs for photos and insurance docs) | Medium | Unlocks photo features |
| 4 | **Admin dashboard frontend** (KPIs, user/vendor management) | Large | Operational necessity |

### Medium Priority (1-2 Months)

| # | Feature | Effort | Value |
|---|---------|--------|-------|
| 5 | **SignalR real-time** notifications + map pin updates | Medium | Better UX, less polling |
| 6 | **Rating/review UI** (star input, comment form, display on profiles) | Small | Trust building |
| 7 | **Google Places autocomplete** for address fields | Small | Reduces geocoding errors |
| 8 | **Push notifications** (service worker + FCM integration) | Medium | Engagement improvement |
| 9 | **Email confirmation in-app flow** (code entry, resend button) | Small | Smoother onboarding |
| 10 | **Job search** (text search, saved filters) | Medium | Discovery improvement |

### Lower Priority (3+ Months)

| # | Feature | Effort | Value |
|---|---------|--------|-------|
| 11 | **Direct messaging** (threaded chat between customer and vendor) | Large | Communication |
| 12 | **Recurring jobs** (subscription scheduling) | Large | Retention |
| 13 | **Native mobile apps** (React Native or PWA) | Very Large | Mobile-first users |
| 14 | **Dark mode** | Small | Polish |
| 15 | **Multi-language (i18n)** | Medium | Market expansion |
| 16 | **Referral/promo codes** | Medium | Growth |
| 17 | **Vendor availability calendar** | Medium | Scheduling efficiency |
| 18 | **Automated pricing suggestions** | Large | Value discovery |

---

## Deployment Documentation

### Environment Variables

```bash
# Required
NEXT_PUBLIC_API_BASE_URL=https://api.yardgig.com
NEXT_PUBLIC_APP_NAME=YardGig
NEXT_PUBLIC_GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com

# Optional (post-MVP)
NEXT_PUBLIC_GOOGLE_MAPS_KEY=
NEXT_PUBLIC_STRIPE_PUBLIC_KEY=
```

### Build & Deploy

```bash
# Local development
cd frontend
npm install
npm run dev          # http://localhost:3000

# Production build
npm run build        # Generates .next/standalone
npm start            # Runs production server

# Docker
docker build -t yardgig-frontend .
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_API_BASE_URL=https://api.yardgig.com \
  yardgig-frontend

# Run tests
npm test             # Vitest (unit tests)
npm run lint         # ESLint
```

### Infrastructure

```yaml
# Add to docker-compose.prod.yml
frontend:
  build:
    context: ./frontend
    dockerfile: Dockerfile
  ports:
    - "3000:3000"
  environment:
    - NEXT_PUBLIC_API_BASE_URL=http://api:8080
  depends_on:
    - api
```

### CI Pipeline Addition

```yaml
# GitHub Actions step for frontend
- name: Frontend Build & Test
  working-directory: ./frontend
  run: |
    npm ci
    npm run lint
    npm test
    npm run build
```

---

## File Summary (This Phase)

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/types.ts` | Rewritten | Strict types with enums, no loose `string` for status fields |
| `src/app/error.tsx` | Enhanced | Error ID display, error logging hook, better copy |
| `src/app/not-found.tsx` | Enhanced | Icon, multiple nav options |
| `src/components/providers.tsx` | Enhanced | Smart retry logic, global error toast for 429 |
| `next.config.ts` | Enhanced | Standalone output, security headers, image domains, static caching |
| `Dockerfile` | New | Multi-stage production build, non-root, standalone |
| `vitest.config.ts` | New | Test runner config with path aliases |
| `src/__tests__/auth-flow.test.ts` | New | 7 unit tests for auth module |
| `src/__tests__/api-client.test.ts` | New | 4 unit tests for API client |
| `PHASE5_DELIVERY.md` | New | This document |
