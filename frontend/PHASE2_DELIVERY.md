# Phase 2 Delivery — Core Marketplace Pages

## Route List

| Route | Page | Auth | Role | Description |
|-------|------|------|------|-------------|
| `/dashboard/customer` | Customer My Jobs | ✅ | Customer | Paginated job list with status filter tabs |
| `/dashboard/vendor` | Vendor Job Browse | ✅ | Vendor | List of nearby open jobs with category/budget filters |
| `/jobs/create` | Create Job Form | ✅ | Customer | Multi-field form with validation |
| `/jobs/[id]` | Job Detail | ✅ | Any | Full job details with photos, status badge, actions |

## Component List

| Component | File | Reusable | Description |
|-----------|------|----------|-------------|
| `JobCard` | `components/jobs/job-card.tsx` | ✅ | Compact card for job lists (links to detail) |
| `JobCardSkeleton` | `components/jobs/job-card-skeleton.tsx` | ✅ | Skeleton loader for job lists |
| `JobListSkeleton` | `components/jobs/job-card-skeleton.tsx` | ✅ | Multiple skeleton cards |
| `VendorJobCard` | `app/dashboard/vendor/page.tsx` | — | Pin-data card with distance and requested badge |
| `Pagination` | `components/ui/pagination.tsx` | ✅ | Page navigation with count display |
| `ErrorState` | `components/ui/error-state.tsx` | ✅ | Error display with retry |
| `EmptyState` | `components/ui/empty-state.tsx` | ✅ | Empty list with action CTA |
| `PageLoader` | `components/ui/spinner.tsx` | ✅ | Full-page loading spinner |

## API Integration Mapping

| Frontend Action | HTTP | Backend Endpoint | Response Type |
|----------------|------|-----------------|---------------|
| Load customer's jobs | GET | `/api/jobs/mine?status=&page=&pageSize=` | `PaginatedResult<JobDetail>` |
| Load nearby jobs (vendor) | GET | `/api/jobs/map?minLat=&maxLat=&minLng=&maxLng=&categories=&minBudget=&maxBudget=&limit=` | `MapQueryResponse` |
| View job details | GET | `/api/jobs/{id}` | `JobDetail` |
| Create new job | POST | `/api/jobs` | `{ id }` |
| Cancel job | PUT | `/api/jobs/{id}/cancel` | `{ message, penaltyApplied }` |
| View vendor requests | GET | `/api/jobs/{id}/requests` | `VendorRequestDto[]` |

## Backend Gaps

| Gap | Description | Resolution |
|-----|-------------|-----------|
| `GET /api/jobs/mine` was missing | No endpoint for customers to list their own jobs (paginated) | **Added in this phase:** `GetMyJobsQuery` + `GetMyJobsHandler` + controller endpoint |

All other endpoints used in this phase were already present in Swagger.

## Design Decisions

1. **URL-param filters:** Status filter and page number stored in URL search params (`?status=Open&page=2`). Enables back-button navigation and bookmarkable views.

2. **Vendor list view uses map API:** The vendor browse page calls `GET /api/jobs/map` with default Denver bounds. In Sprint 5, this becomes the real map; the list view remains as an accessibility fallback.

3. **Budget in dollars (frontend) vs cents (backend):** Form input accepts dollars (`budgetDollars`), converted to cents (`budgetCents = dollars * 100`) before API call. Display helper `formatCents()` reverses this.

4. **Category toggle UX:** Multi-select chips rather than dropdown — faster for the 5 available categories.

5. **Optimistic job card linking:** Job cards link directly to `/jobs/[id]` — the detail page handles its own auth and loading state independently.

## Manual Test Checklist

### Customer Dashboard (`/dashboard/customer`)
- [ ] Shows loading skeletons on initial load
- [ ] Displays job cards when data arrives
- [ ] Shows empty state when no jobs exist
- [ ] Shows error state with retry button on API failure
- [ ] Status filter tabs change URL and reload data
- [ ] Pagination controls appear with > 10 jobs
- [ ] Page param updates URL; back button works
- [ ] "Post Job" button links to `/jobs/create`
- [ ] Non-Customer role redirected to `/unauthorized`

### Job Detail (`/jobs/[id]`)
- [ ] Shows loading spinner while fetching
- [ ] Displays all fields (title, status, budget, address, schedule, categories, description)
- [ ] Shows photos grid when photos exist
- [ ] Shows 404-style error for invalid job ID
- [ ] Back button navigates to previous page
- [ ] "View Vendor Requests" link shown for Open/Requested jobs
- [ ] Status badge has correct color per status

### Create Job (`/jobs/create`)
- [ ] All fields render with labels and placeholders
- [ ] Client validation fires: title min 3, description min 10, budget min $1
- [ ] Category selection toggles (multiple allowed, min 1)
- [ ] Submit sends correct payload (budgetCents = dollars × 100)
- [ ] Shows spinner during submission
- [ ] Toast success → redirect to `/jobs/{newId}`
- [ ] Server errors display in toast (e.g., geocoding failure)
- [ ] Non-Customer role redirected to `/unauthorized`

### Vendor Browse (`/dashboard/vendor`)
- [ ] Shows loading skeletons on initial load
- [ ] Displays nearby job cards with distance
- [ ] "Requested ✓" badge on already-requested jobs
- [ ] Filter panel opens/closes
- [ ] Category filter updates URL and reloads
- [ ] Budget filter applies correctly
- [ ] Empty state shown when no jobs match
- [ ] Error state with retry on failure
- [ ] Non-Vendor role redirected to `/unauthorized`
- [ ] Truncation message shown when `truncated: true`
