# Claude Notes - Database & Project Info

## Railway Database Setup
- PostgreSQL added via Railway dashboard
- DATABASE_URL auto-injected by Railway
- Migrations run automatically on deploy via start script
- Health endpoint shows database connection status

## Current Project State
- Clean API starter template
- Removed all parts/auth specific code  
- Basic endpoints: /, /health, /metrics, /api-docs
- Prisma schema has simple Example model
- All middleware and structure in place

## Railway URLs
- App: https://parts.up.railway.app
- Health: https://parts.up.railway.app/health
- Metrics: https://parts.up.railway.app/metrics
- Docs: https://parts.up.railway.app/api-docs

## GitHub
- Repo: https://github.com/samueldbrewer/Parts
- CI/CD via GitHub Actions configured
- Tests passing (basic health tests)

## Tech Stack
- Node.js 20 + TypeScript
- Express.js
- PostgreSQL + Prisma ORM
- Jest for testing
- Docker ready
- Railway deployment

## Environment Variables (defaults work)
- DATABASE_URL (Railway provides)
- JWT_SECRET (has default)
- MASTER_API_KEY (has default)
- PORT (Railway provides)

## Common Commands
```bash
npm run dev          # Local development
npm run build        # Build TypeScript
npm run migrate      # Run migrations
npm run generate     # Generate Prisma client
npm run seed         # Seed database
npm test            # Run tests
```

## Project Structure
- src/routes/ - API routes
- src/controllers/ - Request handlers
- src/services/ - Business logic
- src/middleware/ - Express middleware
- prisma/schema.prisma - Database schema

## Next Steps When Building
1. Define models in prisma/schema.prisma
2. Run migration: npm run migrate
3. Create routes in src/routes/
4. Add controllers and services
5. Update Swagger docs

## Notes
- App continues running even without database
- Health check always returns 200 (shows DB status)
- All security middleware configured
- Rate limiting active (100 req/min)
- CORS configured
- Helmet.js security headers active