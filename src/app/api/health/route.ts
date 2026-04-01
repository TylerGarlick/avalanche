import { NextResponse } from 'next/server';
import { healthTracker, metrics } from '@/lib/self-healing';

export const dynamic = 'force-dynamic';

export async function GET() {
  const uacHealth = healthTracker.getHealth('UAC') as ReturnType<typeof healthTracker.getHealth>;
  const caicHealth = healthTracker.getHealth('CAIC') as ReturnType<typeof healthTracker.getHealth>;

  const response = {
    status: healthTracker.getOverallStatus(),
    timestamp: new Date().toISOString(),
    sources: {
      uac: uacHealth,
      caic: caicHealth,
    },
    staleDataIndicators: [], // Populated from cache
    uptime: process.uptime(),
  };

  return NextResponse.json(response, {
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}
