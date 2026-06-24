# Authentication & Authorization Specification

## 1. Signup / Login Flow

### 1.1 Email + Password Registration

```
┌──────────┐       ┌──────────┐       ┌──────────┐       ┌──────────┐
│  Client  │──────▶│  POST    │──────▶│ Identity │──────▶│  Email   │
│  (SPA)   │       │ /register│       │  Service │       │  Queue   │
└──────────┘       └──────────┘       └──────────┘       └──────────┘
     │                                      │
     │◀─── { userId, requiresVerification } │
     │                                      │
     │  POST /confirm-email { userId, token }
     │─────────────────────────────────────▶│
     │◀─── { message: "Email confirmed" }   │
     │                                      │
     │  POST /login { email, password }     │
     │─────────────────────────────────────▶│
     │◀─── { accessToken, refreshToken }    │
```

**Steps:**
1. User submits email, password, display name, and role selection.
2. Server validates password policy (12+ chars, upper, lower, digit, special).
3. Server creates Identity user with `EmailConfirmed = false`.
4. Assigns selected roles (Customer / Vendor / both).
5. Creates corresponding domain profiles (CustomerProfile / VendorProfile).
6. Sends confirmation email with a time-limited token (2 hours).
7. User cannot log in until email is confirmed (`RequireConfirmedEmail = true`).
8. After confirmation, login returns JWT access token (15 min) + refresh token.

### 1.2 Google OAuth Flow

```
┌──────────┐       ┌──────────┐       ┌──────────┐
│  Client  │──────▶│  Google  │──────▶│  POST    │
│  (SPA)   │       │  Sign-In │       │ /google  │
└──────────┘       └──────────┘       └──────────┘
     │                                      │
     │◀─── { accessToken, refreshToken }    │
```

**Steps:**
1. Client authenticates with Google and receives an ID token.
2. Client sends ID token + desired roles to `POST /api/auth/google`.
3. Server validates the Google token (signature, audience, expiry).
4. If user doesn't exist: auto-registers with `EmailConfirmed = true` (Google verifies).
5. If user exists: links Google login if not already linked.
6. Returns JWT tokens immediately (no email confirmation needed).

### 1.3 MFA Flow (TOTP)

```
┌──────────┐       ┌──────────┐
│  User    │──────▶│ GET      │
│  (auth)  │       │/mfa/setup│
└──────────┘       └──────────┘
     │◀─── { sharedKey, qrCodeUri }
     │
     │  Scan QR with authenticator app
     │
     │  POST /mfa/verify { code }
     │─────────────────────────────▶│
     │◀─── { mfaEnabled: true }     │
```

After MFA is enabled, login requires the TOTP code:
1. User submits email + password → server responds `{ requiresMfa: true }`.
2. User submits email + password + mfaCode → server validates and returns tokens.

---

## 2. Role Selection UX & Persistence Model

### 2.1 Role Options at Signup

| Selection | Roles Assigned | Profiles Created |
|-----------|---------------|-----------------|
| "I want yard work done" | `Customer` | `CustomerProfile` |
| "I provide yard services" | `Vendor` | `VendorProfile` |
| "Both" | `Customer`, `Vendor` | Both profiles |

**UX Requirements:**
- Role selection is a required step during registration (radio buttons or cards).
- Users can select both roles simultaneously.
- Roles can be added later (e.g., Customer adds Vendor role) via profile settings.
- `Admin` role can NEVER be self-assigned — only granted by existing admins.

### 2.2 Persistence Model

```
identity.Users (ASP.NET Identity)
├── Id (Guid, PK)
├── UserName (= email)
├── Email
├── EmailConfirmed
├── PasswordHash (PBKDF2 via Identity, or Argon2id override)
├── TwoFactorEnabled
├── LockoutEnd
├── AccessFailedCount
├── DisplayName (custom field)
├── IsActive (custom field)
└── SecurityStamp

identity.UserRoles (join table)
├── UserId → Users.Id
└── RoleId → Roles.Id

identity.Roles
├── Id (Guid)
└── Name: "Customer" | "Vendor" | "Admin"
```

---

## 3. Authorization Policies & Route Protection

### 3.1 Policy Definitions

| Policy | Requirements |
|--------|-------------|
| `CustomerOnly` | Role = Customer |
| `VendorOnly` | Role = Vendor |
| `AdminOnly` | Role = Admin AND email_verified = true |
| `CustomerOrVendor` | Role = Customer OR Role = Vendor |
| `EmailVerified` | Claim email_verified = true |
| `MfaEnabled` | Claim mfa_enabled = true |

### 3.2 Route-Level Examples

```csharp
// Only customers can create jobs
[HttpPost]
[Authorize(Policy = "CustomerOnly")]
public async Task<IActionResult> CreateJob(...) { }

// Only vendors can request jobs (map discovery)
[HttpPost("{id}/requests")]
[Authorize(Policy = "VendorOnly")]
public async Task<IActionResult> RequestJob(...) { }

// Any authenticated user can view job details
[HttpGet("{id}")]
[Authorize]
public async Task<IActionResult> GetJobDetail(...) { }

// Admin dashboard — requires Admin role + verified email
[HttpGet("dashboard")]
[Authorize(Policy = "AdminOnly")]
public async Task<IActionResult> GetDashboard(...) { }

// Sensitive admin operations — require MFA
[HttpPut("users/{id}/suspend")]
[Authorize(Policy = "AdminOnly")]
// + custom middleware checks MFA claim
public async Task<IActionResult> SuspendUser(...) { }

// Public endpoints (no auth)
[HttpPost("register")]
[HttpPost("login")]
[AllowAnonymous]
```

### 3.3 Admin Area Protection

The Admin bounded context is protected by:

1. **Role requirement:** `[Authorize(Roles = "Admin")]` on all admin controllers.
2. **Email verification:** Admin policy requires `email_verified = true` claim.
3. **Rate limiting:** Admin endpoints have stricter rate limits (10 req/min).
4. **Audit logging:** Every admin action creates an `AuditEntry` record.
5. **IP allowlisting (optional):** Can be added via middleware for production.

---

## 4. Security Controls

### 4.1 Password Hashing Standards

| Setting | Value | Rationale |
|---------|-------|-----------|
| Algorithm | PBKDF2-SHA256 (Identity default) | ASP.NET Core Identity uses PBKDF2 with 600k iterations (v3 format) |
| Minimum length | 12 characters | NIST SP 800-63B recommendation |
| Require uppercase | Yes | Defense-in-depth |
| Require lowercase | Yes | |
| Require digit | Yes | |
| Require non-alphanumeric | Yes | |
| Unique characters | ≥ 4 | Prevents trivial patterns |

**Note:** Identity's default PBKDF2 is acceptable. For higher security, override `IPasswordHasher<T>` with Argon2id (e.g., via `Isopoh.Cryptography.Argon2`).

### 4.2 Lockout & Rate Limiting

| Control | Configuration |
|---------|--------------|
| Max failed login attempts | 5 |
| Lockout duration | 15 minutes |
| Lockout for new users | Enabled |
| Auth endpoint rate limit | 5 requests per minute per IP |
| Global API rate limit | 100 requests per minute per user |
| Password reset rate limit | 3 per hour per email |

**Implementation:**
- `options.Lockout.MaxFailedAccessAttempts = 5`
- `options.Lockout.DefaultLockoutTimeSpan = TimeSpan.FromMinutes(15)`
- ASP.NET Core Rate Limiting middleware with `FixedWindowLimiter`

### 4.3 CSRF / XSS Protections

| Threat | Mitigation |
|--------|-----------|
| **CSRF** | JWT in `Authorization` header (not cookies) eliminates CSRF for API calls. If using cookie auth for server-rendered pages, anti-forgery tokens are required. |
| **XSS** | `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, CSP headers. API returns JSON only (no HTML rendering). Input validation via FluentValidation. All user-generated content is sanitized before storage. |
| **Clickjacking** | `X-Frame-Options: DENY` + `Content-Security-Policy: frame-ancestors 'none'` |
| **Open Redirect** | Validate all redirect URLs against allowlist. |

### 4.4 Secure Cookie / JWT Guidance

#### JWT Access Token
| Property | Value |
|----------|-------|
| Algorithm | HS256 (symmetric) — move to RS256 in multi-service setup |
| Expiry | 15 minutes |
| Storage | Client-side memory (never localStorage) |
| Transmitted via | `Authorization: Bearer <token>` header |
| Claims included | sub, email, name, roles, email_verified, mfa_enabled, jti |
| Clock skew | 30 seconds |

#### Refresh Token
| Property | Value |
|----------|-------|
| Format | Cryptographically random 64-byte base64 string |
| Expiry | 7 days |
| Storage | HttpOnly, Secure, SameSite=Strict cookie OR secure client storage |
| Rotation | New refresh token issued on each use (one-time use) |
| Revocation | Stored server-side; can be revoked by updating `SecurityStamp` |

#### Security Headers (Middleware)
```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 0
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(self)
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

---

## 5. Test Cases for Auth & Role Enforcement

### 5.1 Registration Tests

```gherkin
Feature: User Registration

Scenario: Successful registration with Customer role
  Given a new user with valid email and strong password
  When they submit registration with roles ["Customer"]
  Then a user account is created with EmailConfirmed = false
  And the user is assigned the "Customer" role
  And a CustomerProfile is created
  And a confirmation email is sent
  And the response contains { userId, requiresEmailVerification: true }

Scenario: Successful registration with both roles
  Given a new user with valid email and strong password
  When they submit registration with roles ["Customer", "Vendor"]
  Then the user is assigned both "Customer" and "Vendor" roles
  And both CustomerProfile and VendorProfile are created

Scenario: Registration fails with weak password
  Given a new user with email "test@example.com" and password "weak"
  When they submit registration
  Then the response is 400 Bad Request
  And errors include password policy violations

Scenario: Registration fails with duplicate email
  Given a user already exists with email "existing@example.com"
  When a new registration is attempted with the same email
  Then the response is 400 Bad Request
  And error is "An account with this email already exists."

Scenario: Registration rejects Admin role self-assignment
  Given a new user
  When they submit registration with roles ["Admin"]
  Then the response is 400 Bad Request
  And error is "Admin role cannot be self-assigned."

Scenario: Registration with no roles defaults to error
  Given a new user with roles []
  When they submit registration
  Then the response is 400 Bad Request
  And error is "At least one valid role is required."
```

### 5.2 Login Tests

```gherkin
Feature: User Login

Scenario: Successful login
  Given a verified user with email "user@example.com" and password "P@ssw0rd!Strong"
  When they submit login credentials
  Then the response contains accessToken, refreshToken, expiresAt, userId, roles
  And the accessToken is a valid JWT with correct claims

Scenario: Login fails with wrong password
  Given a verified user with email "user@example.com"
  When they submit login with incorrect password
  Then the response is 401 Unauthorized
  And the failed access count is incremented
  And error includes remaining attempts

Scenario: Login fails for unverified email
  Given a user with EmailConfirmed = false
  When they submit correct credentials
  Then the response contains { requiresEmailVerification: true }
  And no tokens are issued

Scenario: Account lockout after 5 failed attempts
  Given a verified user
  When they fail login 5 times consecutively
  Then the 6th attempt returns "Account is locked. Try again later."
  And the lockout expires after 15 minutes

Scenario: Deactivated account cannot login
  Given a user with IsActive = false
  When they submit correct credentials
  Then the response is 401 with "Account has been deactivated."

Scenario: MFA required login
  Given a verified user with TwoFactorEnabled = true
  When they submit email and password without mfaCode
  Then the response contains { requiresMfa: true }
  When they resubmit with a valid TOTP code
  Then tokens are issued

Scenario: MFA login with invalid code
  Given a verified user with MFA enabled
  When they submit login with incorrect MFA code
  Then the response is 400 with "Invalid MFA code."
```

### 5.3 Google OAuth Tests

```gherkin
Feature: Google OAuth Login

Scenario: New user registers via Google
  Given no account exists for "google-user@gmail.com"
  When they submit a valid Google ID token with roles ["Vendor"]
  Then a new account is created with EmailConfirmed = true
  And the user is assigned the "Vendor" role
  And a VendorProfile is created
  And tokens are returned immediately

Scenario: Existing user logs in via Google
  Given a user already exists with email "google-user@gmail.com"
  When they submit a valid Google ID token
  Then the Google login is linked if not already
  And tokens are returned

Scenario: Invalid Google token
  When a malformed Google ID token is submitted
  Then the response is 400 with "Invalid Google token."
```

### 5.4 Authorization Policy Tests

```gherkin
Feature: Authorization Policies

Scenario: Customer cannot access vendor-only endpoints
  Given an authenticated user with only the "Customer" role
  When they call POST /api/jobs/{id}/requests
  Then the response is 403 Forbidden

Scenario: Vendor cannot create jobs
  Given an authenticated user with only the "Vendor" role
  When they call POST /api/jobs
  Then the response is 403 Forbidden

Scenario: Non-admin cannot access admin dashboard
  Given an authenticated user with "Customer" role
  When they call GET /api/admin/dashboard
  Then the response is 403 Forbidden

Scenario: Admin with verified email accesses dashboard
  Given an authenticated admin with email_verified = true
  When they call GET /api/admin/dashboard
  Then the response is 200 OK with KPI data

Scenario: Admin without verified email is rejected
  Given an authenticated admin with email_verified = false
  When they call GET /api/admin/dashboard
  Then the response is 403 Forbidden

Scenario: Dual-role user can access both customer and vendor endpoints
  Given an authenticated user with roles ["Customer", "Vendor"]
  When they call POST /api/jobs (create job as customer)
  Then the response is 201 Created
  When they call POST /api/jobs/{id}/requests (request job as vendor)
  Then the response is 200 OK

Scenario: Expired token is rejected
  Given a JWT token that expired 1 minute ago
  When any authenticated endpoint is called
  Then the response is 401 Unauthorized

Scenario: Tampered token is rejected
  Given a JWT token with a modified payload
  When any authenticated endpoint is called
  Then the response is 401 Unauthorized
```

### 5.5 Rate Limiting Tests

```gherkin
Feature: Rate Limiting

Scenario: Auth endpoints are rate limited
  Given the rate limit is 5 requests per minute for auth
  When 6 login requests are sent within 1 minute from the same IP
  Then the 6th request returns 429 Too Many Requests

Scenario: Global rate limit applies
  Given the global limit is 100 requests per minute
  When 101 requests are sent from the same user
  Then the 101st request returns 429 Too Many Requests
```

### 5.6 MFA Tests

```gherkin
Feature: Multi-Factor Authentication

Scenario: User sets up MFA
  Given an authenticated user without MFA
  When they call GET /api/auth/mfa/setup
  Then they receive a shared key and QR code URI
  When they scan the QR code and submit a valid TOTP code to POST /api/auth/mfa/verify
  Then MFA is enabled on their account
  And future logins require the TOTP code

Scenario: MFA setup returns different key per user
  Given two different authenticated users
  When they both call GET /api/auth/mfa/setup
  Then they receive different shared keys
```

### 5.7 Password Reset Tests

```gherkin
Feature: Password Reset

Scenario: Forgot password sends reset email
  Given a registered user with email "user@example.com"
  When they call POST /api/auth/forgot-password
  Then a password reset email is sent
  And the response always returns 200 (no email enumeration)

Scenario: Reset password with valid token
  Given a valid password reset token
  When they call POST /api/auth/reset-password with new password
  Then the password is updated
  And old sessions are invalidated

Scenario: Reset password with expired token
  Given a password reset token older than 2 hours
  When they attempt to reset password
  Then the response is 400 with token error
```

---

## 6. Implementation Checklist

- [x] ASP.NET Core Identity with custom `AppIdentityUser`
- [x] Separate Identity DbContext (`identity` schema)
- [x] JWT Bearer token generation (15 min expiry)
- [x] Refresh token generation and rotation
- [x] Google OAuth integration
- [x] Email confirmation flow
- [x] MFA/TOTP setup and verification
- [x] Password policy (12+ chars, complexity requirements)
- [x] Account lockout (5 attempts, 15 min)
- [x] Rate limiting (auth + global)
- [x] Authorization policies (CustomerOnly, VendorOnly, AdminOnly, etc.)
- [x] Security headers middleware
- [x] Role selection at signup (Customer/Vendor/Both)
- [x] Admin role protection (cannot self-assign)
- [x] Password reset flow
- [x] Token revocation
- [x] Audit logging for admin actions
