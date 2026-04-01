import { NextResponse } from 'next/server';
import { metrics, dataCache } from '@/lib/self-healing';

export const dynamic = 'force-dynamic';

export async function GET() {
  const systemMetrics = metrics.getMetrics();
  const cacheHitRate = metrics.getCacheHitRate();

  const response = {
    timestamp: new Date().toISOString(),
    metrics: {
      heal_success_rate: systemMetrics.heal_success_rate,
      heal_attempts: systemMetrics.heal_attempts,
      heal_successes: systemMetrics.heal_successes,
      drift_detection_count: systemMetrics.drift_detection_count,
      circuit_breaker_trips: systemMetrics.circuit_breaker_trips,
      cache_hit_rate: cacheHitRate,
      cache_hit_count: systemMetrics.cache_hit_count,
      cache_miss_count: systemMetrics.cache_miss_count,
      remediation_cycle_time_ms: systemMetrics.remediation_cycle_time_ms,
    },
    last_failure_detected_at: systemMetrics.last_failure_detected_at,
    last_healed_at: systemMetrics.last_healed_at,
  };

  return NextResponse.json(response, {
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}
