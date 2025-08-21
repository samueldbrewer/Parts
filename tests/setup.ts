import { prisma } from '../src/config/database';

beforeAll(async () => {
  // Setup test database
  process.env.NODE_ENV = 'test';
});

afterAll(async () => {
  // Cleanup and disconnect
  await prisma.$disconnect();
});