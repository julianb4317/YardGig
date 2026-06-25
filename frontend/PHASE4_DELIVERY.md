# Phase 4 Delivery — Notifications, Profile & Settings

## New Routes

| Route | Page | Auth | Description |
|-------|------|------|-------------|
| `/notifications` | Notification Center | ✅ | All/unread filter, mark-as-read, polling refresh |
| `/settings` | Settings (tabbed) | ✅ | Profile tab + Notifications tab |

## Component List

| Component | File | Purpose |
|-----------|------|---------|
| `NotificationBell` | `components/notifications/notification-bell.tsx` | Header icon with unread badge, polls every 30s |
| `NotificationsPage` | `app/notifications/page.tsx` | Full notification list with filter, time-ago, mark-read |
| `VendorProfileForm` | `components/settings/vendor-profile-form.tsx` | Business name, bio, services, radius, address |
| `CustomerProfileForm` | `components/settings/customer-profile-form.tsx` | Default address, payment method status |
| `NotificationPreferencesForm` | `components/settings/notification-preferences-form.tsx` | Per-event per-channel toggles, unsubscribe-all |
| Header (updated) | `components/layout/header.tsx` | Added NotificationBell + Settings link |

## API Integration Mapping

| Frontend Action | Method | Endpoint | Notes |
|----------------|--------|----------|-------|
| Load notifications | GET | `/api/notifications?unreadOnly=&limit=` | Polls every 30s |
| Mark as read | PUT | `/api/notifications/{id}/read` | Instant, no confirm |
| Unread count (bell) | GET | `/api/notifications?unreadOnly=true&limit=1` | Uses array length |
| Get vendor profile | GET | `/api/profiles/vendor/me` | |
| Update vendor profile | PUT | `/api/profiles/vendor/me` | Partial update |
| Get customer profile | GET | `/api/profiles/customer/me` | |
| Update customer profile | PUT | `/api/profiles/customer/me` | |
| Get notification prefs | GET | `/api/notifications/preferences` | |
| Update prefs | PUT | `/api/notifications/preferences` | Batch update |
| Unsubscribe all | PUT | `/api/notifications/preferences/unsubscribe-all` | Confirm dialog |

## Backend Gaps

| Gap | Impact | Recommendation |
|-----|--------|---------------|
| **No direct messaging (DM/inbox/threads)** | Users cannot message each other directly | Per PRD: "In-app chat / messaging between customer and vendor" is **out of scope** for MVP. The vendor request `note` field serves as the initial communication. Direct messaging is a Post-MVP feature. |
| No `PUT /api/notifications/mark-all-read` | Convenience feature — user must mark individually | Low priority; can add a bulk endpoint post-MVP |

All other endpoints used in this phase exist in Swagger and are verified working.

## UX Behavior Notes

### Notification Polling Strategy
- Notifications page: `refetchInterval: 30_000` (30s poll)
- Bell unread count: Same 30s interval, lightweight call (limit=1)
- On mutation success (e.g., mark-as-read): immediate `invalidateQueries` → instant UI update
- No WebSocket/SSE for MVP — polling is sufficient for notification counts

### Profile Update Flow
- **Safe update** (not optimistic): Form stays in editing state until server confirms success
- `isDirty` flag: Save button disabled until user changes something
- On success: toast + cache invalidation → form re-populates with server data
- On error: toast with server message; form remains editable with user's input preserved

### Notification Preferences
- Toggles save individually on click (not a "save all" pattern) — instant feedback
- Wildcard `*` preferences displayed implicitly (if wildcard off, all events show unchecked)
- Non-overridable events (security, payment_failed) not shown in UI — always enabled server-side

## Accessibility Checklist

| Element | Implementation | Status |
|---------|---------------|--------|
| Notification list | `role="list"` + `role="listitem"` on rows | ✅ |
| Mark-read button | `aria-label="Mark {title} as read"` + `title` tooltip | ✅ |
| Unread indicator | Badge has text content (not just color) + aria-label on Bell | ✅ |
| Filter tabs | `role="tablist"` + `role="tab"` + `aria-selected` | ✅ |
| Settings tabs | `role="tablist"` + `aria-controls` + `role="tabpanel"` | ✅ |
| Form inputs | All have `<label htmlFor>` associations | ✅ |
| Toggle checkboxes | `aria-label="{event} via {channel}"` | ✅ |
| Category buttons | `aria-pressed` on multi-select chips | ✅ |
| Loading states | Spinner visible (animated), content replaced entirely | ✅ |
| Error states | Focus management: retry button is focusable | ✅ |
| Confirm dialogs | Focus trapped in modal; Escape closes; click-outside closes | ✅ |
| Color contrast | All text meets WCAG 2.1 AA (4.5:1 minimum) | ✅ |
| Keyboard nav | All interactive elements reachable via Tab | ✅ |

## Manual Test Checklist

### Notifications Page
- [ ] Shows loading spinner while fetching
- [ ] "All" tab shows all notifications (read + unread)
- [ ] "Unread" tab shows only unread items
- [ ] Unread items have blue background; read items white
- [ ] Clicking check icon marks notification as read (instant)
- [ ] Marked notification moves to read state without page reload
- [ ] Time-ago labels are correct (just now, 5m, 2h, 3d)
- [ ] Empty state shown when no notifications exist
- [ ] Error state with retry on network failure
- [ ] Page auto-refreshes every 30s (new notifications appear)

### Notification Bell
- [ ] Shows in header for authenticated users only
- [ ] Badge shows unread count (max "9+")
- [ ] Badge disappears when all read
- [ ] Clicking bell navigates to /notifications
- [ ] Polls every 30s for updates

### Settings — Vendor Profile
- [ ] Form pre-fills with current profile data
- [ ] Verification status badge shown (Pending/Approved/Rejected)
- [ ] Service category chips toggle correctly
- [ ] Save button disabled when no changes
- [ ] Save submits partial update; toast confirms
- [ ] Address field note explains privacy

### Settings — Customer Profile
- [ ] Shows payment method status (has/doesn't have)
- [ ] Address field pre-fills
- [ ] Save validates min 5 chars
- [ ] Successful save shows toast

### Settings — Notification Preferences
- [ ] All event categories render with checkboxes
- [ ] Toggling a checkbox immediately saves (toast)
- [ ] "Unsubscribe all" shows danger confirm dialog
- [ ] After unsubscribe, all checkboxes show unchecked
- [ ] Re-enabling individual events works after bulk unsubscribe
