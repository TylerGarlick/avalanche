import { NextRequest, NextResponse } from 'next/server';
import {
  PatrolZoneView,
  DENSITY_THRESHOLDS,
} from '@/lib/checkInTypes';
import { getActiveCheckIns } from '@/lib/checkInStore';
import { ZONE_COORDINATES } from '@/lib/zone-coordinates';

// Build zone meta from the shared coordinates
const ZONE_META: Record<string, { name: string }> = Object.fromEntries(
  ZONE_COORDINATES.map((z) => [z.zoneId, { name: z.zone }])
);

function getDensityStatus(
  count: number,
  dangerRating: 1 | 2 | 3 | 4 | 5
): PatrolZoneView['densityStatus'] {
  const thresholds = DENSITY_THRESHOLDS[dangerRating];
  if (count >= thresholds.critical) return 'critical';
  if (count >= thresholds.high) return 'high';
  if (count >= thresholds.moderate) return 'moderate';
  return 'low';
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ zoneId: string }> }
) {
  const { zoneId } = await params;
  const meta = ZONE_META[zoneId];

  if (!meta) {
    return NextResponse.json({ error: 'Zone not found' }, { status: 404 });
  }

  const now = new Date();
  const active = await getActiveCheckIns(zoneId);
  const overdue = active.filter((c) => c.expiresAt < now);

  // In production: fetch actual danger rating from forecast
  const dangerRating: 1 | 2 | 3 | 4 | 5 = 3;

  const view: PatrolZoneView = {
    zoneId,
    zoneName: meta.name,
    activeCount: active.length,
    overdueCount: overdue.length,
    dangerRating,
    densityStatus: getDensityStatus(active.length, dangerRating),
    lastUpdated: now,
  };

  return NextResponse.json(view);
}
