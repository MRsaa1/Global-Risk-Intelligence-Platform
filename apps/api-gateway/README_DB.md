# Database Setup Guide

## Prerequisites

- PostgreSQL 16+
- Node.js 20+

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure database

Set environment variable:

```bash
export DATABASE_URL="postgresql://risk_user:risk_password@localhost:5432/risk_platform"
```

Or create `.env` file:

```
DATABASE_URL="postgresql://risk_user:risk_password@localhost:5432/risk_platform"
```

### 3. Generate Prisma Client

```bash
npx prisma generate
```

### 4. Run migrations

```bash
npx prisma migrate dev --name init
```

This will:
- Create migration files
- Apply migrations to database
- Generate Prisma Client

### 5. (Optional) Seed database

```bash
npx prisma db seed
```

## Database Schema

- **scenarios** - Scenario definitions
- **calculations** - Calculation jobs and results
- **portfolios** - Portfolio data
- **users** - User accounts for authentication

## Useful Commands

```bash
# View database in Prisma Studio
npx prisma studio

# Create new migration
npx prisma migrate dev --name migration_name

# Reset database (WARNING: deletes all data)
npx prisma migrate reset

# Generate Prisma Client after schema changes
npx prisma generate
```

## Python Models (Alternative)

If you prefer Python/SQLAlchemy, see:
- `src/db/models.py` - SQLAlchemy models
- `src/db/session.py` - Session management
- `src/db/repositories.py` - Repository pattern

These can be used in a separate Python service if needed.

