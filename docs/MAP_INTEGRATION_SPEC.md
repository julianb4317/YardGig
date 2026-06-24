# Google Maps Integration — Functional Specification

## 1. Overview

The vendor Map Discovery screen is the primary interface for vendors to find and claim yard-work jobs. It renders a Google Map with job pins, supports filtering, clustering, real-time updates, and a click-to-request flow.

---

## 2. Frontend Map Behavior

### 2.1 Initial Center & Zoom Logic

| Priority | Center Source | Zoom Level | Condition |
|----------|--------------|------------|-----------|
| 1 | Browser geolocation | 12 | User grants `navigator.geolocation` permission |
| 2 | Vendor registered home address | 12 | HomeLocation is set in VendorProfile |
| 3 | Default fallback | 10 | City center from app config (e.g., Denver: 39.7392, -104.9903) |

**Implementation:**
```typescript
// Priority 1: Try browser geolocation
navigator.geolocation.getCurrentPosition(
  (pos) => map.setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
  () => fallbackToProfile(), // Permission denied or error
  { enableHighAccuracy: true, timeout: 5000 }
);

// Priority 2: Profile home location (from GET /api/profiles/vendor/me)
// Priority 3: Static fallback from env config
```

### 2.2 Current Location Option

- A "My Location" button (FloatingActionButton style) re-centers on browser GPS.
- Button pulses while acquiring position.
- If GPS is unavailable, show toast: "Location unavailable. Showing saved address."
- A blue dot marker indicates vendor's current position (distinct from job pins).

### 2.3 Bounds-Based Data Fetch on Pan/Zoom

**Trigger:** Every time the map `idle` event fires (after pan/zoom completes).

**Flow:**
1. Get current map bounds: `map.getBounds()` → `{ sw: {lat, lng}, ne: {lat, lng} }`.
2. Debounce 300ms (prevents rapid successive calls during animation).
3. Call `GET /api/jobs/map?minLat=...&maxLat=...&minLng=...&maxLng=...`.
4. Replace current pin set with response data.
5. Apply client-side filter state (categories, budget) as query params.

**Debounce logic:**
```typescript
let debounceTimer: number;
map.addListener('idle', () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => fetchJobsForBounds(), 300);
});
```

### 2.4 Marker Clustering

| Zoom Level | Behavior |
|------------|----------|
| < 10 | Large clusters (50+ radius), show count badge |
| 10–12 | Medium clusters (30 radius) |
| 13+ | Individual pins (no clustering) |

**Library:** `@googlemaps/markerclusterer` (official Google library).

**Cluster appearance:**
- Circle with count number
- Color: blue (#2563EB) base
- Size scales with count: small (2-9), medium (10-49), large (50+)

### 2.5 Pin Icons & Colors

| Job Category | Icon | Pin Color |
|--------------|------|-----------|
| Mowing | 🌿 grass icon | Green (#16A34A) |
| Hedge trimming | ✂️ scissors | Emerald (#059669) |
| Leaf removal | 🍂 leaf | Amber (#D97706) |
| Snow clearing | ❄️ snowflake | Blue (#2563EB) |
| General yard work | 🏡 house | Gray (#6B7280) |
| Multiple categories | ⭐ star | Purple (#7C3AED) |

| Pin State | Visual Modifier |
|-----------|----------------|
| Open (available) | Solid color, normal size |
| Already requested by this vendor | Gray outline, "✓" badge |
| Expiring soon (< 24h) | Pulsing animation |

### 2.6 Pin Click Behavior — Job Card

When a vendor clicks a pin, an **InfoWindow/Card panel** opens with:

```
┌─────────────────────────────────────┐
│ 🌿 Front Yard Mowing               │
├─────────────────────────────────────┤
│ 💰 $45 - $65                        │
│ 📍 2.3 mi away                      │
│ 📅 Sat Jun 28 – Sun Jun 29         │
│ 🏷️ Mowing, Edging                  │
│                                     │
│ "Need front and back yard mowed..." │
│                                     │
│  ┌─────────────────────────────┐    │
│  │     🟢 REQUEST JOB          │    │
│  └─────────────────────────────┘    │
│                                     │
│  [View Full Details]                │
└─────────────────────────────────────┘
```

**Card fields:**
- Title (truncated to 40 chars)
- Budget range (formatted as dollars)
- Distance from vendor's current position
- Schedule window (formatted date range)
- Categories (as tags/chips)
- Description (truncated to 120 chars)
- **"Request Job"** primary CTA button
- "View Full Details" secondary link (opens modal)

**Interactions:**
- Clicking "Request Job" → `POST /api/jobs/{id}/requests`
- On success: pin changes to "Requested" state, toast notification, card CTA disabled
- On failure (already claimed): toast error, refresh pin status
- Clicking "View Full Details" → opens full-screen modal with complete job info

---

## 3. API Contracts

### 3.1 GET /api/jobs/map — Bounds-Based Map Query

**Purpose:** Primary data source for the map. Returns lightweight pin data for all open jobs within the visible viewport bounds.

**Request:**
```
GET /api/jobs/map?minLat=39.68&maxLat=39.80&minLng=-105.05&maxLng=-104.93
    &categories=mowing,hedging
    &maxBudget=10000
    &minBudget=2000
    &dateFrom=2026-06-24
    &dateTo=2026-07-01
    &limit=200
```

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `minLat` | float | ✅ | — | Southwest latitude of viewport |
| `maxLat` | float | ✅ | — | Northeast latitude of viewport |
| `minLng` | float | ✅ | — | Southwest longitude of viewport |
| `maxLng` | float | ✅ | — | Northeast longitude of viewport |
| `categories` | string | ❌ | all | Comma-separated category filter |
| `minBudget` | int | ❌ | — | Minimum budget in cents |
| `maxBudget` | int | ❌ | — | Maximum budget in cents |
| `dateFrom` | date | ❌ | — | Schedule start not before this date |
| `dateTo` | date | ❌ | — | Schedule start not after this date |
| `limit` | int | ❌ | 200 | Max pins returned (capped at 500) |

**Response: 200 OK**
```json
{
  "pins": [
    {
      "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "title": "Front Yard Mowing",
      "categories": ["mowing", "edging"],
      "budgetCents": 4500,
      "latitude": 39.7392,
      "longitude": -104.9903,
      "scheduleStart": "2026-06-28T09:00:00Z",
      "scheduleEnd": "2026-06-29T17:00:00Z",
      "distanceMeters": 3704.5,
      "vendorRequested": false,
      "expiresAt": "2026-07-01T00:00:00Z"
    }
  ],
  "totalInBounds": 47,
  "truncated": false
}
```

| Field | Description |
|-------|-------------|
| `pins` | Array of job pin data |
| `totalInBounds` | Total matching jobs in bounds (before limit) |
| `truncated` | True if more results exist beyond limit |
| `vendorRequested` | Whether the current vendor has already requested this job |

**Error Responses:**
- `400 Bad Request` — Invalid coordinates (lat outside ±90, lng outside ±180)
- `401 Unauthorized` — Missing or invalid JWT
- `429 Too Many Requests` — Rate limit exceeded

---

### 3.2 GET /api/jobs/{jobId} — Job Detail

**Purpose:** Full job details for the detail modal.

**Response: 200 OK**
```json
{
  "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "title": "Front Yard Mowing",
  "description": "Need front and back yard mowed, edged, and clippings bagged.",
  "categories": ["mowing", "edging"],
  "address": "1234 Elm St, Denver, CO 80202",
  "latitude": 39.7392,
  "longitude": -104.9903,
  "status": "Open",
  "budgetCents": 4500,
  "scheduleStart": "2026-06-28T09:00:00Z",
  "scheduleEnd": "2026-06-29T17:00:00Z",
  "photos": ["https://storage.example.com/jobs/photo1.jpg"],
  "createdAt": "2026-06-24T10:00:00Z",
  "customerProfileId": "...",
  "vendorRequestCount": 3,
  "vendorRequested": false
}
```

**Note:** `address` shows approximate address to non-assigned vendors (street number obscured). Full address revealed only after assignment.

**Error Responses:**
- `404 Not Found` — Job doesn't exist or has been deleted

---

### 3.3 POST /api/jobs/{jobId}/requests — Request Job

**Purpose:** Vendor clicks "Request Job" CTA on the map card.

**Request:**
```json
{
  "proposedPriceCents": 5000,
  "note": "I can do this Saturday morning. Have all equipment."
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `proposedPriceCents` | int | ❌ | Vendor's proposed price (optional) |
| `note` | string | ❌ | Message to customer (max 500 chars) |

**Response: 200 OK**
```json
{
  "vendorRequestId": "7ba85f64-5717-4562-b3fc-2c963f66afa6",
  "message": "Job requested successfully."
}
```

**Error Responses:**
- `400 Bad Request`
  - `"You have already requested this job."` — Duplicate request
  - `"Job is no longer open for requests."` — Job was claimed/cancelled/expired
  - `"Vendor must be verified to request jobs."` — Profile not approved
- `404 Not Found` — Job doesn't exist
- `401 Unauthorized` — Not authenticated
- `403 Forbidden` — Not a vendor role

---

## 4. Performance Requirements

### 4.1 Debounce Map Move Events

| Event | Debounce Delay | Rationale |
|-------|---------------|-----------|
| `idle` (pan/zoom) | 300ms | Prevents rapid API calls during animated movement |
| Filter change | 150ms | Filters apply immediately after brief typing pause |
| Search input | 500ms | Address search waits for user to finish typing |

### 4.2 Pagination/Limit for Dense Areas

- Default limit: **200 pins** per viewport query.
- Hard cap: **500 pins** (server rejects higher values).
- If `truncated: true`, frontend shows banner: "Showing 200 of 347 jobs. Zoom in to see all."
- At extreme zoom-out (zoom < 8), client shows warning instead of fetching: "Zoom in to see available jobs."

### 4.3 Cache Recent Map Queries

**Client-side caching strategy:**

```typescript
// Cache key: rounded bounds + filters hash
const cacheKey = `${roundBounds(bounds)}_${filtersHash}`;
const cached = mapCache.get(cacheKey);
if (cached && Date.now() - cached.timestamp < 30_000) {
  renderPins(cached.data);
  return;
}
```

| Cache | TTL | Scope |
|-------|-----|-------|
| Client-side (in-memory) | 30 seconds | Prevents re-fetch on small pan that stays in same tile |
| Server-side (Redis) | 10 seconds | Shared across concurrent vendor requests for same area |

**Cache invalidation:**
- SignalR `JobCreated` / `JobRemoved` events flush relevant client cache.
- Server cache invalidated on any job status change in the cached area.

### 4.4 Server Performance Targets

| Metric | Target | Condition |
|--------|--------|-----------|
| Map query latency (p95) | ≤ 200ms | 10k open jobs in metro, viewport covers ~5 mi² |
| Map query latency (p99) | ≤ 500ms | 50k open jobs, zoomed-out view |
| Pin payload size | ≤ 50 KB | 200 pins (gzipped) |
| SignalR push latency | ≤ 1 second | New job appears on nearby vendor maps |

---

## 5. Error Handling

### 5.1 Invalid Geocodes

| Scenario | Handling |
|----------|----------|
| Bounds cross antimeridian (lng < -180 or > 180) | Normalize to ±180; split into two queries |
| Bounds with zero area (min == max) | Return empty results, no error |
| Bounds covering entire planet | Reject with 400: "Viewport too large. Please zoom in." |
| NaN or missing coordinates | 400 validation error before query |

### 5.2 Stale / Already-Claimed Jobs

| Scenario | API Response | Frontend Behavior |
|----------|-------------|-------------------|
| Job claimed between pin load and click | 400: "Job is no longer open" | Remove pin, show toast: "This job is no longer available." |
| Vendor already requested this job | 400: "Already requested" | Disable CTA, show "Requested ✓" |
| Job expired | 400: "Job has expired" | Remove pin, show toast |
| Job deleted/cancelled | 404 on detail fetch | Remove pin silently |

**Optimistic UI pattern:**
1. On "Request Job" click → immediately change pin to "Requested" state.
2. Send API request.
3. On success → confirm state.
4. On failure → revert pin state, show error toast.

### 5.3 Map API Quota Errors

| Google Maps Error | Handling |
|-------------------|----------|
| `OVER_QUERY_LIMIT` | Show banner: "Map temporarily unavailable. Showing list view." Switch to list fallback. |
| `REQUEST_DENIED` (invalid key) | Log error, show permanent banner to admin. Fall back to list view. |
| Map tiles fail to load | Retry 3x with exponential backoff. After failure, show static map image + list. |
| Geocoding quota exceeded | Cache aggressively. Queue geocoding requests. Show "Address lookup temporarily delayed." |

**Fallback list view:**
When map is unavailable, render a card-based list sorted by distance with the same data from the map API. Users can still request jobs from the list.

---

## 6. SignalR Real-Time Updates

### 6.1 Events

| Event | Payload | Vendor Action |
|-------|---------|---------------|
| `JobCreated` | `JobPinDto` | Add pin to map if within current viewport |
| `JobRemoved` | `{ jobId }` | Remove pin + close card if open for that job |
| `JobUpdated` | `{ jobId, status }` | Update pin appearance or remove |

### 6.2 Connection Lifecycle

```typescript
const connection = new signalR.HubConnectionBuilder()
  .withUrl('/hubs/jobmap', { accessTokenFactory: () => getToken() })
  .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
  .build();

connection.on('JobCreated', (pin: JobPinDto) => {
  if (isWithinCurrentBounds(pin)) {
    addPinToMap(pin);
  }
});

connection.on('JobRemoved', (jobId: string) => {
  removePinFromMap(jobId);
  if (openCardJobId === jobId) closeCard();
});
```

---

## 7. API Implementation — Bounds Query

### New Query (supplements existing radius-based query)

```csharp
// GET /api/jobs/map?minLat=&maxLat=&minLng=&maxLng=...
// Uses PostGIS ST_MakeEnvelope for bounding box query
// Significantly faster than ST_DWithin for viewport-based queries

SELECT id, title, categories, budget_cents, 
       ST_Y(location::geometry) as lat, ST_X(location::geometry) as lng,
       schedule_start, schedule_end
FROM "JobRequests"
WHERE status = 'Open'
  AND location && ST_MakeEnvelope(:minLng, :minLat, :maxLng, :maxLat, 4326)::geography
ORDER BY created_at DESC
LIMIT :limit;
```

### Index Strategy

The existing GiST index on `location` supports both `ST_DWithin` (radius) and `&&` (bounding box) operators efficiently.

---

## 8. Accessibility

- All map interactions have a keyboard-accessible list view alternative.
- Pin info cards are accessible via Tab + Enter.
- Screen readers announce: "Job: [title], [budget], [distance] away. Press Enter to request."
- Color is never the sole differentiator — icons distinguish categories.
- "Request Job" button has `aria-label="Request job: [title]"`.
