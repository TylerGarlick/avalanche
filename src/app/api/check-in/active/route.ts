import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const now = new Date();
    const checkIn = await prisma.checkIn.findFirst({
      where: {
        status: 'active',
        expiresAt: { lt: now },
      },
      orderBy: { checkedInAt: 'desc' },
    });

    if (!checkIn) {
      return NextResponse.json({ checkIn: null });
    }

    return NextResponse.json({
      checkIn: {
        id: checkIn.id,
        zoneId: checkIn.zoneId,
        checkedInAt: checkIn.checkedInAt.toISOString(),
        expiresAt: checkIn.expiresAt.toISOString(),
        status: checkIn.status,
      },
    });
  } catch (error) {
    console.error('Failed to fetch active check-in:', error);
    return NextResponse.json({ error: 'Failed to fetch check-in' }, { status: 500 });
  }
}
