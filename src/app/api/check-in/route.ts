import { NextRequest, NextResponse } from 'next/server';
import { DEFAULT_CHECK_IN_DURATION_HOURS } from '@/lib/checkInTypes';
import {
  createCheckIn,
  getActiveCheckIns,
  checkOut,
} from '@/lib/checkInStore';

// POST /api/check-in — create a new check-in
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { zoneId, partnerToken } = body;

    if (!zoneId) {
      return NextResponse.json(
        { error: 'zoneId is required' },
        { status: 400 }
      );
    }

    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + DEFAULT_CHECK_IN_DURATION_HOURS * 60 * 60 * 1000
    );

    const checkIn = await createCheckIn({
      zoneId,
      partnerCode: partnerToken,
      expiresAt,
    });

    return NextResponse.json({
      id: checkIn.id,
      checkedInAt: checkIn.checkedInAt.toISOString(),
      expiresAt: checkIn.expiresAt.toISOString(),
      zoneId: checkIn.zoneId,
    });
  } catch (error) {
    console.error('Check-in error:', error);
    return NextResponse.json(
      { error: 'Failed to check in' },
      { status: 500 }
    );
  }
}

// GET /api/check-in?zoneId=xxx — get active check-ins for a zone
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const zoneId = searchParams.get('zoneId');

  if (!zoneId) {
    return NextResponse.json(
      { error: 'zoneId is required' },
      { status: 400 }
    );
  }

  try {
    const active = await getActiveCheckIns(zoneId);

    return NextResponse.json({
      count: active.length,
      active: active.map((c) => ({
        id: c.id,
        checkedInAt: c.checkedInAt.toISOString(),
        expiresAt: c.expiresAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Get check-ins error:', error);
    return NextResponse.json(
      { error: 'Failed to get check-ins' },
      { status: 500 }
    );
  }
}

// DELETE /api/check-in?id=xxx&zoneId=xxx — check out
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const zoneId = searchParams.get('zoneId');

  if (!id || !zoneId) {
    return NextResponse.json(
      { error: 'id and zoneId are required' },
      { status: 400 }
    );
  }

  try {
    const result = await checkOut(id);
    if (!result) {
      return NextResponse.json(
        { error: 'Check-in not found' },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Check-out error:', error);
    return NextResponse.json(
      { error: 'Failed to check out' },
      { status: 500 }
    );
  }
}
