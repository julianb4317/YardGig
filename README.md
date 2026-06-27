# Rakr — Yard-Work Gig Marketplace

A production-ready ASP.NET Core + PostgreSQL/PostGIS marketplace connecting homeowners with local yard-work vendors via map-based job discovery.

## Architecture

Modular monolith with clean architecture layers:

```
src/
├── Rakr.Domain          # Entities, enums, value objects, domain events
├── Rakr.Application     # CQRS handlers (MediatR), interfaces, DTOs, validators
├── Rakr.Infrastructure  # EF Core DbContext, PostGIS, Stripe, SignalR, services
└── Rakr.Api             # Controllers, Program.cs, auth config, middleware
```

**Bounded Contexts:** Identity & Access · Job Marketplace · Payments & Ledger · Notifications · Admin & Trust/Safety

## Prerequisites

- [.NET 9 SDK](https://dotnet.microsoft.com/download/dotnet/9.0)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for PostgreSQL + PostGIS and Redis)
- Google Maps API key (for geocoding)
- Stripe account (for payments)

## Quick Start

```bash
# 1. Start infrastructure
docker-compose up -d

# 2. Apply database migrations
dotnet dotnet-ef database update --project src/Rakr.Infrastructure --startup-project src/Rakr.Api

# 3. Run the API
dotnet run --project src/Rakr.Api

# 4. Open Swagger UI
# https://localhost:5001/swagger
```

## Configuration

Edit `src/Rakr.Api/appsettings.Development.json`:

| Key | Description |
|-----|-------------|
| `ConnectionStrings:DefaultConnection` | PostgreSQL connection string |
| `Jwt:Key` | JWT signing key (min 32 chars) |
| `GoogleMaps:ApiKey` | Google Geocoding API key |
| `Stripe:SecretKey` | Stripe secret key |
| `Cors:Origins` | Allowed frontend origins |

## Key Features

- **Map-based job discovery** — Google Maps with clustered pins, geospatial queries via PostGIS
- **Real-time updates** — SignalR hub pushes new/removed pins to connected vendors
- **Job lifecycle** — Full state machine (Open → Requested → Assigned → In-Progress → Completed → Paid → Closed)
- **Payments** — Stripe Connect with platform fee, automatic vendor payouts
- **Ratings** — Bi-directional rating system with average recalculation
- **Admin dashboard** — KPIs, vendor verification, dispute resolution, user suspension
- **Audit trail** — Append-only audit log for all admin/system actions

## API Endpoints

| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login, get JWT |
| GET | `/api/jobs/nearby` | Map pins (geospatial query) |
| GET | `/api/jobs/{id}` | Job details |
| POST | `/api/jobs` | Create job (Customer) |
| POST | `/api/jobs/{id}/requests` | Request job (Vendor) |
| PUT | `/api/jobs/{id}/assign` | Assign vendor (Customer) |
| PUT | `/api/jobs/{id}/status` | Update job status |
| POST | `/api/payments/capture` | Capture payment |
| POST | `/api/ratings` | Submit rating |
| POST | `/api/disputes` | Raise dispute |
| GET | `/api/admin/dashboard` | Admin KPIs |
| SignalR | `/hubs/jobmap` | Real-time map updates |

## Tech Stack

- **API:** ASP.NET Core 9, MediatR (CQRS), FluentValidation
- **Database:** PostgreSQL 16 + PostGIS 3.4, Entity Framework Core 9
- **Real-time:** SignalR with Redis backplane
- **Payments:** Stripe Connect
- **Logging:** Serilog (structured, console sink)
- **Auth:** JWT Bearer tokens
