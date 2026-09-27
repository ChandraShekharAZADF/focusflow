import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error'] : ['error'],
});

export let isDbConnected = false;

export async function checkDbConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    isDbConnected = true;
    console.log('✅ Connected to PostgreSQL database');
    return true;
  } catch (err) {
    isDbConnected = false;
    console.log('ℹ️  PostgreSQL not detected on localhost:5432.');
    console.log('✨ Activated Dev In-Memory Database with seeded demo data!');
    console.log('👉 Sign in with: demo@focusflow.io / password123 (or create any new account)');
    return false;
  }
}

// Initial probe
checkDbConnection();

export default prisma;
