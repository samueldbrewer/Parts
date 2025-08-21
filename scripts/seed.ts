import { PrismaClient, Role, PartStatus } from '@prisma/client';
import bcrypt from 'bcrypt';
import { config } from '../src/config/env';

const prisma = new PrismaClient();

async function seed() {
  console.log('🌱 Starting database seed...');

  try {
    // Clear existing data
    await prisma.inventoryLog.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.part.deleteMany();
    await prisma.user.deleteMany();
    await prisma.apiKey.deleteMany();

    // Create users
    const adminPassword = await bcrypt.hash('Admin123!', config.security.bcryptRounds);
    const userPassword = await bcrypt.hash('User123!', config.security.bcryptRounds);

    const admin = await prisma.user.create({
      data: {
        email: 'admin@partsapi.com',
        username: 'admin',
        password: adminPassword,
        firstName: 'Admin',
        lastName: 'User',
        role: Role.ADMIN,
        isActive: true,
      },
    });

    const manager = await prisma.user.create({
      data: {
        email: 'manager@partsapi.com',
        username: 'manager',
        password: userPassword,
        firstName: 'Manager',
        lastName: 'User',
        role: Role.MANAGER,
        isActive: true,
      },
    });

    const regularUser = await prisma.user.create({
      data: {
        email: 'user@partsapi.com',
        username: 'user',
        password: userPassword,
        firstName: 'Regular',
        lastName: 'User',
        role: Role.USER,
        isActive: true,
      },
    });

    console.log('✅ Users created');

    // Create parts
    const parts = [
      {
        partNumber: 'CPU-001',
        name: 'Intel Core i9-12900K',
        description: 'High-performance desktop processor',
        manufacturer: 'Intel',
        category: 'Processors',
        subcategory: 'Desktop CPUs',
        price: 589.99,
        cost: 450.00,
        quantity: 25,
        minQuantity: 10,
        location: 'A1-B2',
        barcode: '1234567890123',
        sku: 'INT-I9-12900K',
        weight: 0.125,
        tags: ['high-performance', 'gaming', 'intel'],
        status: PartStatus.ACTIVE,
        createdBy: admin.id,
      },
      {
        partNumber: 'GPU-001',
        name: 'NVIDIA RTX 4090',
        description: 'Flagship graphics card for gaming and AI',
        manufacturer: 'NVIDIA',
        category: 'Graphics Cards',
        subcategory: 'Gaming GPUs',
        price: 1599.99,
        cost: 1200.00,
        quantity: 10,
        minQuantity: 5,
        location: 'A2-C3',
        barcode: '2345678901234',
        sku: 'NVD-RTX-4090',
        weight: 2.3,
        tags: ['gaming', 'ai', 'nvidia', 'rtx'],
        status: PartStatus.ACTIVE,
        createdBy: admin.id,
      },
      {
        partNumber: 'RAM-001',
        name: 'Corsair Vengeance 32GB DDR5',
        description: '32GB (2x16GB) DDR5 5600MHz Memory Kit',
        manufacturer: 'Corsair',
        category: 'Memory',
        subcategory: 'Desktop RAM',
        price: 189.99,
        cost: 140.00,
        quantity: 50,
        minQuantity: 20,
        location: 'B1-A1',
        barcode: '3456789012345',
        sku: 'COR-DDR5-32GB',
        weight: 0.1,
        tags: ['memory', 'ddr5', 'corsair'],
        status: PartStatus.ACTIVE,
        createdBy: manager.id,
      },
      {
        partNumber: 'SSD-001',
        name: 'Samsung 980 PRO 2TB NVMe',
        description: 'High-speed NVMe SSD with PCIe 4.0',
        manufacturer: 'Samsung',
        category: 'Storage',
        subcategory: 'NVMe SSDs',
        price: 229.99,
        cost: 180.00,
        quantity: 35,
        minQuantity: 15,
        location: 'C1-D2',
        barcode: '4567890123456',
        sku: 'SAM-980PRO-2TB',
        weight: 0.008,
        tags: ['storage', 'nvme', 'samsung', 'pcie4'],
        status: PartStatus.ACTIVE,
        createdBy: manager.id,
      },
      {
        partNumber: 'MB-001',
        name: 'ASUS ROG Strix Z790-E',
        description: 'High-end motherboard for Intel 12th/13th gen',
        manufacturer: 'ASUS',
        category: 'Motherboards',
        subcategory: 'Intel Motherboards',
        price: 449.99,
        cost: 350.00,
        quantity: 15,
        minQuantity: 8,
        location: 'D1-A3',
        barcode: '5678901234567',
        sku: 'ASUS-Z790-E',
        weight: 1.5,
        tags: ['motherboard', 'asus', 'rog', 'z790'],
        status: PartStatus.ACTIVE,
        createdBy: admin.id,
      },
      {
        partNumber: 'PSU-001',
        name: 'Corsair RM1000x',
        description: '1000W 80+ Gold Modular Power Supply',
        manufacturer: 'Corsair',
        category: 'Power Supplies',
        subcategory: 'ATX PSUs',
        price: 189.99,
        cost: 140.00,
        quantity: 20,
        minQuantity: 10,
        location: 'E1-B2',
        barcode: '6789012345678',
        sku: 'COR-RM1000X',
        weight: 2.0,
        tags: ['psu', 'corsair', 'modular', '80plus-gold'],
        status: PartStatus.ACTIVE,
        createdBy: manager.id,
      },
      {
        partNumber: 'CASE-001',
        name: 'Lian Li O11 Dynamic',
        description: 'Premium mid-tower case with tempered glass',
        manufacturer: 'Lian Li',
        category: 'Cases',
        subcategory: 'Mid Tower',
        price: 149.99,
        cost: 100.00,
        quantity: 12,
        minQuantity: 6,
        location: 'F1-C1',
        barcode: '7890123456789',
        sku: 'LIAN-O11D',
        weight: 8.5,
        tags: ['case', 'lian-li', 'tempered-glass'],
        status: PartStatus.ACTIVE,
        createdBy: admin.id,
      },
      {
        partNumber: 'COOL-001',
        name: 'Noctua NH-D15',
        description: 'Premium dual-tower CPU cooler',
        manufacturer: 'Noctua',
        category: 'Cooling',
        subcategory: 'CPU Coolers',
        price: 109.99,
        cost: 80.00,
        quantity: 0,
        minQuantity: 10,
        location: 'G1-A2',
        barcode: '8901234567890',
        sku: 'NOC-NHD15',
        weight: 1.3,
        tags: ['cooling', 'noctua', 'air-cooler'],
        status: PartStatus.OUT_OF_STOCK,
        createdBy: manager.id,
      },
    ];

    for (const partData of parts) {
      await prisma.part.create({
        data: partData,
      });
    }

    console.log('✅ Parts created');

    // Create API keys
    await prisma.apiKey.create({
      data: {
        key: 'pk_test_1234567890abcdef',
        name: 'Test API Key',
        description: 'API key for testing purposes',
        permissions: ['read:parts', 'write:parts'],
        isActive: true,
      },
    });

    console.log('✅ API keys created');

    console.log('🎉 Database seed completed successfully!');
    console.log('\n📝 Test Credentials:');
    console.log('Admin: admin@partsapi.com / Admin123!');
    console.log('Manager: manager@partsapi.com / User123!');
    console.log('User: user@partsapi.com / User123!');
    console.log('\n🔑 Test API Key: pk_test_1234567890abcdef');

  } catch (error) {
    console.error('❌ Seed failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

seed().catch((error) => {
  console.error(error);
  process.exit(1);
});