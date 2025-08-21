# Parts Inventory API

A production-ready, enterprise-grade RESTful API for managing parts inventory and catalog systems. Built with Node.js, TypeScript, Express, PostgreSQL, and Prisma ORM.

## 🚀 Features

### Core Functionality
- **Parts Management**: Complete CRUD operations for parts inventory
- **Authentication**: JWT-based authentication with refresh tokens
- **Authorization**: Role-based access control (RBAC) with multiple user roles
- **API Key Support**: Alternative authentication method for service-to-service communication
- **Inventory Tracking**: Real-time inventory management with transaction logging
- **Search & Filter**: Advanced search capabilities with pagination

### Security Features
- **Helmet.js**: Security headers protection
- **Rate Limiting**: Configurable request throttling (100 req/min default)
- **Input Validation**: Comprehensive request validation using Joi
- **SQL Injection Prevention**: Parameterized queries via Prisma ORM
- **Password Hashing**: Bcrypt with configurable rounds
- **CORS Support**: Configurable cross-origin resource sharing

### Technical Features
- **TypeScript**: Full type safety and IntelliSense support
- **OpenAPI 3.0**: Auto-generated API documentation with Swagger UI
- **Structured Logging**: Winston logger with correlation IDs
- **Health Checks**: Built-in health and metrics endpoints
- **Docker Support**: Multi-stage Docker build for production
- **CI/CD Pipeline**: GitHub Actions workflow for automated testing and deployment
- **Database Migrations**: Version-controlled schema migrations with Prisma

## 📋 Prerequisites

- Node.js 20+ 
- PostgreSQL 15+
- npm or yarn
- Docker & Docker Compose (optional)

## 🛠️ Installation

### Local Development

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/Parts.git
cd Parts
```

2. **Install dependencies**
```bash
npm install
```

3. **Set up environment variables**
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. **Set up the database**
```bash
# Run PostgreSQL locally or use Docker
docker-compose up -d postgres

# Run migrations
npm run migrate

# Seed the database (optional)
npm run seed
```

5. **Start the development server**
```bash
npm run dev
```

The API will be available at `http://localhost:3000`

### Docker Setup

```bash
# Build and run all services
docker-compose up -d

# View logs
docker-compose logs -f api

# Stop services
docker-compose down
```

## 📚 API Documentation

### Interactive Documentation
Once the server is running, visit:
- Swagger UI: `http://localhost:3000/api-docs`
- Health Check: `http://localhost:3000/health`
- Metrics: `http://localhost:3000/metrics`

### Authentication

#### JWT Authentication
```bash
# Register
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "username": "johndoe",
    "password": "SecurePass123!",
    "firstName": "John",
    "lastName": "Doe"
  }'

# Login
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!"
  }'
```

#### API Key Authentication
```bash
curl -X GET http://localhost:3000/api/v1/parts \
  -H "X-API-Key: your-api-key"
```

### Core Endpoints

#### Parts Management
- `GET /api/v1/parts` - List all parts (paginated)
- `GET /api/v1/parts/:id` - Get part by ID
- `POST /api/v1/parts` - Create new part (requires auth)
- `PUT /api/v1/parts/:id` - Update part (requires auth)
- `DELETE /api/v1/parts/:id` - Delete part (admin only)
- `POST /api/v1/parts/:id/inventory` - Update inventory

#### Authentication
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login user
- `POST /api/v1/auth/refresh` - Refresh access token
- `POST /api/v1/auth/logout` - Logout user
- `GET /api/v1/auth/me` - Get current user
- `POST /api/v1/auth/change-password` - Change password
- `POST /api/v1/auth/generate-api-key` - Generate API key

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run unit tests
npm run test:unit

# Run integration tests
npm run test:integration

# Generate coverage report
npm test -- --coverage
```

## 📝 Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server with hot reload |
| `npm run build` | Build TypeScript to JavaScript |
| `npm start` | Start production server |
| `npm test` | Run all tests with coverage |
| `npm run lint` | Run ESLint |
| `npm run format` | Format code with Prettier |
| `npm run migrate` | Run database migrations |
| `npm run seed` | Seed database with sample data |
| `npm run generate-swagger` | Generate OpenAPI specification |

## 🚢 Deployment

### Railway Deployment

1. Install Railway CLI
```bash
npm install -g @railway/cli
```

2. Login and initialize
```bash
railway login
railway init
```

3. Add PostgreSQL database
```bash
railway add
```

4. Deploy
```bash
railway up
```

### Docker Deployment

```bash
# Build production image
docker build -t parts-api:latest .

# Run container
docker run -p 3000:3000 --env-file .env parts-api:latest
```

### Environment Variables

Key environment variables (see `.env.example` for full list):

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `development` |
| `PORT` | Server port | `3000` |
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `JWT_SECRET` | JWT signing secret | Required |
| `JWT_REFRESH_SECRET` | Refresh token secret | Required |
| `MASTER_API_KEY` | Master API key for admin access | Required |

## 🏗️ Project Structure

```
Parts/
├── src/
│   ├── config/         # Configuration files
│   ├── controllers/    # Request handlers
│   ├── middleware/     # Express middleware
│   ├── routes/         # API routes
│   ├── services/       # Business logic
│   ├── validators/     # Input validation schemas
│   ├── types/          # TypeScript type definitions
│   ├── utils/          # Utility functions
│   ├── errors/         # Custom error classes
│   ├── app.ts          # Express app setup
│   └── index.ts        # Server entry point
├── prisma/
│   └── schema.prisma   # Database schema
├── tests/
│   ├── unit/           # Unit tests
│   └── integration/    # Integration tests
├── scripts/            # Utility scripts
├── docker-compose.yml  # Docker composition
├── Dockerfile          # Docker build instructions
└── package.json        # Project dependencies
```

## 🔒 Security

- All passwords are hashed using bcrypt
- JWT tokens expire after 7 days (configurable)
- Rate limiting prevents abuse
- Input validation on all endpoints
- SQL injection protection via Prisma ORM
- Security headers via Helmet.js
- CORS configuration for API access

## 📊 Database Schema

### Main Tables
- **Users**: User accounts with roles
- **Parts**: Parts inventory items
- **InventoryLogs**: Transaction history
- **AuditLogs**: System audit trail
- **ApiKeys**: API key management

### User Roles
- `ADMIN`: Full system access
- `MANAGER`: Manage parts and inventory
- `USER`: View and limited edit access
- `VIEWER`: Read-only access

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support, email support@partsapi.com or open an issue in the GitHub repository.

## 🎯 Roadmap

- [ ] GraphQL API support
- [ ] Real-time updates via WebSockets
- [ ] Advanced analytics dashboard
- [ ] Multi-tenant support
- [ ] Elasticsearch integration
- [ ] Redis caching layer
- [ ] Webhook notifications
- [ ] Bulk import/export
- [ ] Mobile app API endpoints
- [ ] OAuth2 integration

## 🙏 Acknowledgments

- Built with Express.js and TypeScript
- Database ORM: Prisma
- Authentication: JSON Web Tokens
- Documentation: Swagger/OpenAPI
- Testing: Jest & Supertest

---

**Built with ❤️ using modern Node.js best practices**