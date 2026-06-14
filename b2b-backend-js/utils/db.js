import 'dotenv/config'; 
import pkg from '@prisma/client';
const { PrismaClient } = pkg;
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const { Pool } = pg;

// 1. Create a connection pool to your Neon database
const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  // 2. Neon requires SSL, so we explicitly enable it here
  ssl: {
    rejectUnauthorized: false
  }
});

// 3. Wrap the pool in Prisma's PostgreSQL adapter
const adapter = new PrismaPg(pool);

// 4. Initialize Prisma with the adapter
const prisma = new PrismaClient({ adapter });

export default prisma;