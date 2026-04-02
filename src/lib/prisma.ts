// Prisma singleton — prevents connection pool exhaustion in serverless
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

// Vercel Postgres / Neon has connection limits in serverless
// Add connection_limit=1 to prevent pool exhaustion
function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) return 'postgresql://placeholder:placeholder@placeholder:5432/postgres?sslmode=require';
  // Limit connections per instance in serverless
  if (!url.includes('connection_limit')) {
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}connection_limit=1&pool_timeout=10`;
  }
  return url;
}

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    datasources: {
      db: {
        url: getDatabaseUrl(),
      },
    },
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
