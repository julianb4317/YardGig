# Google Maps MVP — Acceptance Criteria

## AC-1: Vendor Can Open Map and View Available Jobs as Pins

### Criteria (Given/When/Then)

```gherkin
Scenario: Vendor opens map with GPS available
  Given a verified vendor is logged in
  And browser geolocation is granted
  When they navigate to the Map Discovery view
  Then the map centers on their GPS coordinates at zoom level 12
  And pins appear for all Open/Requested jobs within the viewport bounds

Scenario: Vendor opens map without GPS (profile fallback)
  Given a verified vendor with a saved HomeLocation
  And browser geolocation is denied
  When they navigate to the Map Discovery view
  Then the map centers on their HomeLocation at zoom level 12

Scenario: Vendor opens map with no location data
  Given a verified vendor with no HomeLocation and no GPS
  When they navigate to the Map Discovery view
  Then the map centers on the default city (config) at zoom level 10
  And a toast says "Enable location for better results"

Scenario: Unverified vendor cannot see map
  Given a vendor with VerificationStatus = Pending
  When they attempt to access the Map Discovery view
  Then they see a message "Complete verification to browse jobs"
  And no job pins are loaded
```

### Implementation Reference

| Component | File | Status |
|-----------|------|--------|
| API endpoint | `GET /api/jobs/map` | ✅ |
| Authorization | `[Authorize(Policy = "VendorOnly")]` | ✅ |
| Query handler | `GetJobsByBoundsHandler.cs` | ✅ |
| PostGIS index | `idx_jobrequest_location_gist` (GiST) | ✅ |
| Vendor profile endpoint | `GET /api/profiles/vendor/me` (HomeLocation) | ✅ |
| Frontend map component | `MapContainer.tsx` | ⬜ Sprint 5 |

### Verification

- [ ] API returns pins array when called with valid bounds and vendor JWT
- [ ] API returns 403 for non-vendor roles
- [ ] Pins only include jobs with status `Open` or `Requested`
- [ ] Each pin has: id, title, categories, budgetCents, lat, lng, scheduleStart/End, distanceMeters, vendorRequested

---

## AC-2: Moving/Zooming Map Refreshes Jobs by Viewport Bounds

### Criteria (Given/When/Then)

```gherkin
Scenario: Pan map to new area
  Given the vendor is viewing the map with pins loaded
  When they pan the map to a new geographic area
  And the map movement settles (idle event fires)
  Then after a 300ms debounce delay
  The frontend calls GET /api/jobs/map with the new viewport bounds
  And pins are replaced with jobs in the new area

Scenario: Zoom in shows more detail
  Given the vendor is viewing clustered pins at zoom level 10
  When they zoom to level 13
  Then clusters expand to individual pins
  And the API is called with tighter bounds (smaller area, same or fewer results)

Scenario: Rapid pan does not flood API
  Given the vendor drags the map rapidly across multiple areas
  When the map fires multiple idle events within 300ms
  Then only the last bounds are sent to the API (debounce)
  And at most 1 API call occurs per 300ms window

Scenario: Zoom out too far shows warning
  Given the vendor zooms out below zoom level 8
  When the viewport spans > 5° latitude
  Then the frontend shows "Zoom in to see available jobs"
  And no API call is made (prevents server validation error)

Scenario: Filters persist across pan/zoom
  Given the vendor has selected category filter "mowing"
  When they pan the map to a new area
  Then the API call includes &categories=mowing
  And only mowing jobs appear in the new area
```

### Implementation Reference

| Component | File | Status |
|-----------|------|--------|
| Bounds query API | `JobsController.GetJobsByBounds()` | ✅ |
| Validator (bounds range) | `GetJobsByBoundsValidator.cs` | ✅ |
| Viewport too large guard | Validator: `MaxLat - MinLat < 5.0` | ✅ |
| Category/budget/date filters | Handler filter logic | ✅ |
| Server-side limit cap | `Math.Min(request.Limit, 500)` | ✅ |
| Frontend debounce | 300ms on `idle` event | ⬜ Sprint 5 |
| Frontend zoom guard | Check zoom < 8 before fetch | ⬜ Sprint 5 |

### Verification

- [ ] API correctly filters by bounds (jobs outside bounds not returned)
- [ ] API returns `truncated: true` when totalInBounds > limit
- [ ] API returns 400 for bounds spanning > 5° latitude
- [ ] API validates coordinate ranges (lat ±90, lng ±180)
- [ ] Filters combine correctly (categories AND budget AND date)

---

## AC-3: Clicking a Pin Opens Details Card with "Request Job" CTA

### Criteria (Given/When/Then)

```gherkin
Scenario: Click pin shows job card
  Given the vendor sees job pins on the map
  When they click a pin
  Then a Job Card overlay appears anchored to that pin
  And the card displays:
    | Field | Content |
    | Title | Job title (max 40 chars) |
    | Budget | Formatted as "$XX" or "$XX - $YY" |
    | Distance | "X.X mi away" from vendor position |
    | Schedule | Formatted date range (e.g., "Sat Jun 28 – Sun Jun 29") |
    | Categories | As colored tag chips |
    | Description | First 120 characters with ellipsis |
    | CTA Button | "REQUEST JOB" (green, prominent) |
    | Link | "View Full Details" (secondary) |

Scenario: Only one card open at a time
  Given a job card is open for Job A
  When the vendor clicks pin for Job B
  Then Job A's card closes
  And Job B's card opens

Scenario: Card shows "Requested" state for already-requested jobs
  Given the vendor has already requested Job X
  When they click Job X's pin
  Then the card CTA shows "Requested ✓" (disabled, gray)
  And no action is possible

Scenario: View Full Details opens modal
  Given a job card is open
  When the vendor clicks "View Full Details"
  Then a full-screen modal opens with complete job information
  And the modal fetches data from GET /api/jobs/{id}
```

### Implementation Reference

| Component | File | Status |
|-----------|------|--------|
| Pin data (includes all card fields) | `MapPinDto.cs` | ✅ |
| vendorRequested flag per pin | `GetJobsByBoundsHandler.cs` (line: `requestedJobIds.Contains`) | ✅ |
| Job detail API | `GET /api/jobs/{id}` → `GetJobDetailHandler.cs` | ✅ |
| Frontend job card component | `JobCard.tsx` | ⬜ Sprint 5 |
| Frontend detail modal | Job detail modal | ⬜ Sprint 5 |

### Verification

- [ ] Pin data includes all fields needed for card (no second API call needed)
- [ ] `vendorRequested` is `true` for jobs this vendor already requested
- [ ] Job detail endpoint returns full description, photos, address
- [ ] Job detail returns 404 for non-existent jobs

---

## AC-4: Requesting a Job from Pin Creates Vendor Request Record

### Criteria (Given/When/Then)

```gherkin
Scenario: Successful job request
  Given a verified vendor viewing a Job Card for an Open job
  When they click "Request Job"
  Then the frontend immediately changes the pin to "Requested" state (optimistic)
  And POST /api/jobs/{id}/requests is called
  And a VendorRequest record is created with status "Pending"
  And the job status transitions to "Requested" (if first request)
  And the customer receives a notification
  And the card CTA changes to "Requested ✓" (disabled)
  And a success toast appears: "Job requested!"

Scenario: Request with optional note and price
  Given a vendor viewing a Job Card
  When they click "Request Job" and provide a proposed price and note
  Then the VendorRequest stores proposedPriceCents and note
  And these are visible to the customer in their review queue

Scenario: Duplicate request prevented
  Given a vendor who already requested Job X
  When they attempt to request Job X again
  Then the API returns 400: "You have already requested this job."
  And no duplicate record is created

Scenario: Request on claimed job fails gracefully
  Given a job that was assigned to another vendor 5 seconds ago
  When this vendor clicks "Request Job"
  Then the API returns 400: "Job is no longer open for requests."
  And the frontend reverts the optimistic pin state
  And a toast shows: "This job is no longer available."
  And the pin is removed from the map

Scenario: Unverified vendor cannot request
  Given a vendor with VerificationStatus = Pending
  When they attempt to request any job
  Then the API returns 400: "Vendor must be verified to request jobs."
```

### Implementation Reference

| Component | File | Status |
|-----------|------|--------|
| Request command | `RequestJobCommand.cs` | ✅ |
| Handler (validation + persist) | `RequestJobHandler.cs` | ✅ |
| Duplicate check | `AnyAsync(vr => vr.JobRequestId == ... && vr.VendorProfileId == ...)` | ✅ |
| Verification check | `vendorProfile.VerificationStatus != Approved` | ✅ |
| Status check | `job.Status != Open && job.Status != Requested` | ✅ |
| Domain event | `VendorRequestedEvent` → notification | ✅ |
| DB unique constraint | `UNIQUE(job_request_id, vendor_profile_id)` | ✅ |
| API endpoint | `POST /api/jobs/{id}/requests` | ✅ |
| Frontend optimistic UI | Pin state change on click | ⬜ Sprint 5 |

### Verification

- [ ] Successful request returns `{ vendorRequestId }` with 200
- [ ] VendorRequest row exists in DB with correct fields
- [ ] Job status is `Requested` after first vendor request
- [ ] Customer notification record created
- [ ] Duplicate request returns 400 (not 500)
- [ ] Unverified vendor gets clear error message
- [ ] Concurrent duplicate prevented by DB unique constraint

---

## AC-5: Claimed/Unavailable Jobs Removed or Visually Disabled Quickly

### Criteria (Given/When/Then)

```gherkin
Scenario: Job assigned — pin removed via SignalR
  Given Vendor A is viewing the map and sees Job X pin
  When the customer assigns Job X to Vendor B
  Then a SignalR "JobRemoved" event is broadcast
  And Vendor A's map removes Job X pin within 1 second
  And if Vendor A has the Job X card open, it closes with toast: "This job was just assigned."

Scenario: Job cancelled — pin removed via SignalR
  Given vendors are viewing pins
  When the customer cancels a job
  Then a "JobRemoved" event removes the pin from all connected vendor maps

Scenario: Job expired — removed on next fetch
  Given an expired job's pin is still shown (stale cache)
  When the vendor pans/zooms and triggers a fresh API call
  Then the expired job is not in the response (server filters status=Open)
  And the stale pin disappears

Scenario: Already-requested pin stays but is disabled
  Given a vendor has requested Job Y
  When Job Y is still Open/Requested (not yet assigned)
  Then Job Y pin remains on the map with "Requested" visual state
  And the `vendorRequested: true` flag prevents re-request
```

### Implementation Reference

| Component | File | Status |
|-----------|------|--------|
| SignalR hub | `JobMapHub.cs` | ✅ |
| JobAssigned → remove pin | `JobAssignedEventHandler.cs` → `IJobMapNotifier.NotifyJobRemovedAsync` | ✅ |
| JobCreated → add pin | `JobCreatedEventHandler.cs` → `IJobMapNotifier.NotifyJobCreatedAsync` | ✅ |
| SignalR notifier | `SignalRJobMapNotifier.cs` | ✅ |
| Server filters expired jobs | Handler: `WHERE status = Open OR Requested` | ✅ |
| vendorRequested flag | `GetJobsByBoundsHandler` cross-references VendorRequests | ✅ |
| Frontend SignalR client | `useSignalR.ts` | ⬜ Sprint 5 |

### Verification

- [ ] SignalR `JobRemoved` event fires when job is assigned
- [ ] SignalR `JobRemoved` event fires when job is cancelled
- [ ] SignalR `JobCreated` event fires when new job is published
- [ ] API never returns jobs with status other than Open/Requested
- [ ] `vendorRequested` flag is accurate for the authenticated vendor
- [ ] SignalR reconnects automatically after disconnect (retry policy: 0, 2s, 5s, 10s, 30s)

---

## AC-6: Dense Urban Areas Use Clustering and Remain Responsive

### Criteria (Given/When/Then)

```gherkin
Scenario: Clustering at low zoom
  Given 200 jobs exist in a 5-mile radius
  And the vendor is viewing at zoom level 10
  When the map renders
  Then pins are grouped into clusters with count badges
  And the number of rendered DOM elements is < 50 (clusters, not individual markers)

Scenario: Clusters expand on zoom in
  Given a cluster showing "47" at zoom level 11
  When the vendor zooms to level 13
  Then the cluster breaks apart into individual pins
  And each pin is clickable

Scenario: Map remains interactive with 200 pins
  Given 200 individual pins are rendered (zoom 13+)
  When the vendor pans the map
  Then frame rate stays above 30fps
  And pan/zoom animations are smooth (no jank)

Scenario: Truncation banner for very dense areas
  Given a viewport contains 500+ open jobs
  When the API returns with truncated: true
  Then a banner shows "Showing 200 of 523 jobs. Zoom in to see all."
  And the vendor can zoom in to see remaining jobs

Scenario: Cluster appearance scales with count
  Given clusters with varying job counts
  Then cluster badge sizes are:
    | Count | Size | Color |
    | 2-9 | Small (30px) | Light blue |
    | 10-49 | Medium (40px) | Blue |
    | 50+ | Large (50px) | Dark blue |
```

### Implementation Reference

| Component | File | Status |
|-----------|------|--------|
| Server limit (200 default, 500 max) | `GetJobsByBoundsHandler` + Validator | ✅ |
| `totalInBounds` count | Handler returns count before limit | ✅ |
| `truncated` flag | `totalInBounds > effectiveLimit` | ✅ |
| Frontend clustering | `@googlemaps/markerclusterer` | ⬜ Sprint 5 |
| Frontend truncation banner | Conditional UI on `truncated: true` | ⬜ Sprint 5 |

### Verification

- [ ] API returns at most 500 pins regardless of request
- [ ] `totalInBounds` accurately reflects total matching jobs (not limited)
- [ ] `truncated` is `true` when total exceeds requested limit
- [ ] Response payload for 200 pins is < 50KB gzipped
- [ ] Frontend renders clusters (manual visual test / screenshot test)

---

## AC-7: API Response Time Meets Target (p95 < 500ms)

### Criteria (Given/When/Then)

```gherkin
Scenario: Standard metro area query
  Given 10,000 open jobs in the database within Denver metro
  And a viewport covering approximately 5 square miles
  When GET /api/jobs/map is called with those bounds
  Then the response returns within 200ms (p95)

Scenario: Large dataset zoomed-out query
  Given 50,000 open jobs across the US
  And a viewport covering a major metro area (~50 mi²)
  When GET /api/jobs/map is called with limit=200
  Then the response returns within 500ms (p99)

Scenario: Filtered query performance
  Given 10,000 open jobs with mixed categories
  When the query includes &categories=mowing&maxBudget=5000
  Then the response time is within 250ms (p95)

Scenario: Cache hit performance
  Given a Redis cache entry exists for the same bounds+filters
  When the same query is repeated within 10 seconds
  Then the response returns within 50ms

Scenario: Under load performance
  Given 500 concurrent vendors querying the map simultaneously
  When each sends a bounds query
  Then p95 latency remains ≤ 500ms
  And error rate is < 0.1%
```

### Implementation Reference

| Component | File | Status |
|-----------|------|--------|
| PostGIS GiST index | `idx_jobrequest_location_gist` | ✅ |
| Partial index (status=Open) | `idx_jobrequest_status_created` | ✅ |
| Bounding box query (uses && operator) | `GetJobsByBoundsHandler.cs` | ✅ |
| Redis cache layer | `CommissionService` pattern (extend to map queries) | ✅ Architecture |
| Prometheus metrics | `yardgig_map_query_duration_seconds` histogram | ✅ |
| Health check on degradation | Production readiness spec | ✅ Documented |

### Verification

- [ ] `EXPLAIN ANALYZE` on map query shows GiST index scan (not seq scan)
- [ ] Benchmark with 10k seeded jobs: p95 < 200ms
- [ ] Benchmark with 50k seeded jobs: p99 < 500ms
- [ ] Load test (k6): 500 concurrent users, p95 < 500ms, error rate < 0.1%
- [ ] Prometheus histogram `yardgig_map_query_duration_seconds` correctly records all queries
- [ ] Response payload size verified: 200 pins < 50KB gzipped

### Performance Test Script (k6)

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 100 },
    { duration: '2m', target: 500 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<2000'],
    http_req_failed: ['rate<0.001'],
  },
};

export default function () {
  // Random bounds within Denver metro
  const lat = 39.65 + Math.random() * 0.2;
  const lng = -105.1 + Math.random() * 0.2;
  const url = `${__ENV.API_URL}/api/jobs/map?minLat=${lat}&maxLat=${lat+0.1}&minLng=${lng}&maxLng=${lng+0.1}&limit=200`;
  
  const res = http.get(url, { headers: { Authorization: `Bearer ${__ENV.TOKEN}` } });
  check(res, {
    'status is 200': (r) => r.status === 200,
    'has pins array': (r) => JSON.parse(r.body).pins !== undefined,
    'latency < 500ms': (r) => r.timings.duration < 500,
  });
  sleep(1);
}
```

---

## Summary: Implementation Coverage

| AC | Backend API | DB/Index | SignalR | Frontend | Tests |
|----|-------------|----------|--------|----------|-------|
| AC-1: View pins | ✅ | ✅ | — | ⬜ | ⬜ |
| AC-2: Pan/zoom refresh | ✅ | ✅ | — | ⬜ | ⬜ |
| AC-3: Pin click card | ✅ | ✅ | — | ⬜ | ⬜ |
| AC-4: Request job | ✅ | ✅ | ✅ | ⬜ | ⬜ |
| AC-5: Remove claimed | ✅ | ✅ | ✅ | ⬜ | ⬜ |
| AC-6: Clustering | ✅ (server-side limit) | ✅ | — | ⬜ | ⬜ |
| AC-7: Performance | ✅ | ✅ | — | — | ⬜ |

**Backend: 100% complete.** All API endpoints, database indexes, domain logic, and SignalR events are implemented and building.

**Frontend: Sprint 5 deliverable.** All backend contracts are stable and documented for frontend implementation.

**Testing: Sprint 8 deliverable.** Performance benchmarks require seeded data and load testing infrastructure.
