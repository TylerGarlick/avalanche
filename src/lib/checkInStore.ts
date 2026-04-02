// Prisma-backed check-in store for Vercel Postgres
// Survives serverless cold starts — data lives in PostgreSQL, not memory
import { prisma } from './prisma';
import { CheckIn, CheckInStatus } from './checkInTypes';

function toCheckIn(r: {
  id: string;
  zoneId: string;
  partnerCode: string | null;
  checkedInAt: Date;
  expiresAt: Date;
  status: string;
}): CheckIn {
  return {
    id: r.id,
    zoneId: r.zoneId,
    partnerToken: r.partnerCode ?? undefined,
    checkedInAt: r.checkedInAt,
    expiresAt: r.expiresAt,
    status: r.status as CheckInStatus,
  };
}

export async function createCheckIn(data: {
  zoneId: string;
  partnerCode?: string;
  expiresAt: Date;
}): Promise<CheckIn> {
  const id = crypto.randomUUID();
  const result = await prisma.checkIn.create({
    data: {
      id,
      zoneId: data.zoneId,
      partnerCode: data.partnerCode || null,
      expiresAt: data.expiresAt,
      status: 'active',
    },
  });
  return toCheckIn(result);
}

export async function getCheckIn(id: string): Promise<CheckIn | null> {
  const result = await prisma.checkIn.findUnique({ where: { id } });
  return result ? toCheckIn(result) : null;
}

export async function getActiveCheckIns(zoneId: string): Promise<CheckIn[]> {
  const results = await prisma.checkIn.findMany({
    where: {
      zoneId,
      status: 'active',
      expiresAt: { gt: new Date() },
    },
    orderBy: { checkedInAt: 'asc' },
  });
  return results.map(toCheckIn);
}

export async function getActiveCheckInCount(zoneId: string): Promise<number> {
  return prisma.checkIn.count({
    where: {
      zoneId,
      status: 'active',
      expiresAt: { gt: new Date() },
    },
  });
}

export async function checkOut(id: string): Promise<CheckIn | null> {
  const result = await prisma.checkIn.update({
    where: { id },
    data: { status: 'checked_out' },
  });
  return toCheckIn(result);
}

export async function getAllZoneStats(): Promise<
  { zoneId: string; activeCount: number; overdueCount: number }[]
> {
  const zones = await prisma.checkIn.findMany({
    where: { status: 'active', expiresAt: { gt: new Date() } },
    select: { zoneId: true },
    distinct: ['zoneId'],
  });

  const now = new Date();
  return Promise.all(
    zones.map(async ({ zoneId }: { zoneId: string }) => {
      const [activeCount, overdueCount] = await Promise.all([
        prisma.checkIn.count({
          where: { zoneId, status: 'active', expiresAt: { gt: now } },
        }),
        prisma.checkIn.count({
          where: { zoneId, status: 'active', expiresAt: { lt: now } },
        }),
      ]);
      return { zoneId, activeCount, overdueCount };
    })
  );
}

// Expire old check-ins (call periodically or on startup)
export async function expireOldCheckIns(): Promise<number> {
  const result = await prisma.checkIn.updateMany({
    where: {
      status: 'active',
      expiresAt: { lt: new Date() },
    },
    data: { status: 'expired' },
  });
  return result.count;
}
