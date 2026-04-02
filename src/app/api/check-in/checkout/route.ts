import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  try {
    const { id } = await req.json();

    if (!id) {
      return NextResponse.json({ error: 'Check-in ID required' }, { status: 400 });
    }

    const checkIn = await prisma.checkIn.update({
      where: { id },
      data: { status: 'checked_out' },
    });

    return NextResponse.json({ success: true, checkInId: checkIn.id });
  } catch (error) {
    console.error('Checkout failed:', error);
    return NextResponse.json({ error: 'Failed to check out' }, { status: 500 });
  }
}
