# API Starter Template

A production-ready API starter template with TypeScript, Express, PostgreSQL, and Prisma. Clean slate for building your own API.

## 🚀 Features

### Infrastructure
- **TypeScript**: Full type safety and modern JavaScript features
- **Express.js**: Fast, unopinionated web framework
- **PostgreSQL**: Robust relational database
- **Prisma ORM**: Type-safe database access with migrations
- **Docker**: Containerized deployment ready

### Developer Experience
- **Hot Reload**: Nodemon for development
- **Testing**: Jest configured for unit and integration tests
- **Linting**: ESLint with TypeScript support
- **Formatting**: Prettier for consistent code style
- **API Documentation**: Swagger/OpenAPI with interactive UI
- **Logging**: Structured logging with Winston
- **Environment Config**: Validated env variables with Joi

### Security & Performance
- **Helmet.js**: Security headers
- **CORS**: Configurable cross-origin support
- **Rate Limiting**: Built-in request throttling
- **Compression**: Response compression
- **Input Validation**: Request validation with Joi

### DevOps
- **GitHub Actions**: CI/CD pipeline configured
- **Railway**: Production deployment ready
- **Health Checks**: Built-in health and metrics endpoints
- **Docker**: Multi-stage build for optimal image size

## 📋 Prerequisites

- Node.js 20+
- PostgreSQL 15+
- npm or yarn

## 🛠️ Installation

### Local Development

1. **Clone and install**
```bash
git clone https://github.com/yourusername/Parts.git
cd Parts
npm install
```

2. **Set up environment**
```bash
cp .env.example .env
# Edit .env with your database connection
```

3. **Set up database**
```bash
# Run migrations
npm run migrate

# Generate Prisma client
npm run generate

# Seed database (optional)
npm run seed
```

4. **Start development server**
```bash
npm run dev
```

API runs at `http://localhost:3000`

### Docker Setup

```bash
# Build and run
docker-compose up -d

# Stop
docker-compose down
```

## 📚 Project Structure

```
src/
├── config/         # Configuration files
├── controllers/    # Request handlers
├── middleware/     # Express middleware  
├── routes/         # API routes
├── services/       # Business logic
├── validators/     # Input validation
├── types/          # TypeScript types
├── utils/          # Utilities
├── errors/         # Error classes
├── app.ts          # Express app
└── index.ts        # Server entry
```

## 🔧 Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build TypeScript |
| `npm start` | Start production server |
| `npm test` | Run tests |
| `npm run lint` | Run ESLint |
| `npm run format` | Format code |
| `npm run migrate` | Run migrations |
| `npm run seed` | Seed database |

## 🏗️ Building Your API

### 1. Define Your Schema

Edit `prisma/schema.prisma`:

```prisma
model User {
  id        String   @id @default(uuid())
  email     String   @unique
  name      String?
  posts     Post[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Post {
  id        String   @id @default(uuid())
  title     String
  content   String?
  published Boolean  @default(false)
  author    User     @relation(fields: [authorId], references: [id])
  authorId  String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

### 2. Run Migration

```bash
npm run migrate
```

### 3. Create Routes

Add to `src/routes/index.ts`:

```typescript
import userRoutes from './user.routes';
router.use('/users', userRoutes);
```

### 4. Add Controllers

Create controllers in `src/controllers/`

### 5. Add Services

Business logic in `src/services/`

## 📖 Default Endpoints

- `GET /` - API welcome
- `GET /health` - Health check
- `GET /metrics` - System metrics
- `GET /api-docs` - Swagger UI

## 🚢 Deployment

### Railway

1. Push to GitHub
2. Connect repo in Railway
3. Add PostgreSQL database
4. Deploy

### Environment Variables

Key variables (see `.env.example`):

- `DATABASE_URL` - PostgreSQL connection
- `PORT` - Server port
- `NODE_ENV` - Environment mode
- `JWT_SECRET` - For auth (if needed)

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Commit changes
4. Push to branch
5. Open pull request

## 📄 License

MIT License

---

**Ready to build your API!**