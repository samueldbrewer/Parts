# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Commands

```bash
# Development
npm run dev                 # Start development server with hot reload (nodemon)
npm run build              # Compile TypeScript to JavaScript
npm start                  # Run production server

# Database
npm run migrate            # Run Prisma migrations (dev mode)
npm run migrate:deploy     # Run migrations in production
npm run generate           # Generate Prisma client
npm run seed              # Seed database with test data

# Testing
npm test                   # Run all tests with coverage
npm run test:watch        # Run tests in watch mode
npm run test:unit         # Run unit tests only
npm run test:integration  # Run integration tests only

# Code Quality
npm run lint              # Run ESLint
npm run lint:fix         # Auto-fix ESLint issues
npm run format           # Format code with Prettier

# Documentation
npm run generate-swagger  # Generate Swagger documentation
```

## Architecture Overview

### Express App Structure

- **src/app.ts**: Main Express application setup with middleware stack:
  - Security (Helmet, CORS)
  - Body parsing & compression
  - Request correlation & logging
  - Rate limiting (100 req/min general, 5 req/min for auth)
  - Routes mounted at `/api/v1` and `/api`
  - Global error handling

### Middleware Pipeline

1. **Security**: Helmet for security headers, CORS configuration
2. **Correlation**: Adds X-Correlation-Id to track requests
3. **Logging**: Morgan for HTTP logs, Winston for structured logging
4. **Rate Limiting**: Different limits for general API and auth endpoints
5. **Validation**: Joi-based request validation middleware
6. **Auth**: JWT-based authentication skeleton (implement as needed)
7. **Error Handler**: Centralized error handling with custom error classes

### Database Layer

- **Prisma ORM**: Type-safe database access
- **PostgreSQL**: Primary database
- Migrations stored in `prisma/migrations/`
- Connection pooling configured (min: 2, max: 10)

### Configuration Management

- **Environment Variables**: Validated using Joi schema
- **Config Module** (`src/config/env.ts`): Centralized configuration
- Supports different environments (development, production, test)
- Defaults provided for all non-sensitive values

## Railway Deployment

### URLs

- App: https://parts.up.railway.app
- Health: https://parts.up.railway.app/health
- Metrics: https://parts.up.railway.app/metrics
- API Docs: https://parts.up.railway.app/api-docs

### Deployment Process

1. Push to main branch on GitHub
2. GitHub Actions CI runs tests
3. Railway auto-deploys on successful CI
4. Migrations run automatically via start script
5. Health endpoint confirms database connectivity

### Environment Variables

Railway auto-injects:

- `DATABASE_URL`: PostgreSQL connection string
- `PORT`: Application port

Application defaults handle:

- `JWT_SECRET`: Has secure default
- `MASTER_API_KEY`: Has secure default
- Other configs: Sensible defaults in `src/config/env.ts`

## Testing Strategy

### Test Configuration

- **Framework**: Jest with ts-jest preset
- **Coverage**: Configured for src/ directory
- **Setup**: Tests use `tests/setup.ts` for initialization
- **Timeout**: 10 seconds per test

### Test Structure

```
tests/
├── unit/          # Isolated unit tests
├── integration/   # API integration tests
└── setup.ts       # Test environment setup
```

### Running Specific Tests

```bash
# Single test file
npm test -- src/services/example.service.test.ts

# Pattern matching
npm test -- --testNamePattern="should create"

# Update snapshots
npm test -- -u
```

## Development Workflow

### Adding New Features

1. **Define Schema**: Update `prisma/schema.prisma`
2. **Create Migration**: `npm run migrate`
3. **Generate Client**: `npm run generate`
4. **Create Route**: Add to `src/routes/`
5. **Add Controller**: Implement in `src/controllers/`
6. **Business Logic**: Add to `src/services/`
7. **Validation**: Create schemas in `src/validators/`
8. **Update Docs**: Run `npm run generate-swagger`

### Error Handling Pattern

- Use custom error classes from `src/errors/AppError.ts`
- Throw errors in services/controllers
- Middleware automatically handles error responses
- Consistent error format with correlation IDs

### Security Considerations

- JWT tokens validated in auth middleware
- API key authentication available via X-API-Key header
- Rate limiting prevents abuse
- Input validation on all endpoints
- SQL injection prevented via Prisma parameterized queries
