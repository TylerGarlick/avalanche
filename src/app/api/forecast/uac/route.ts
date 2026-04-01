import { NextResponse } from 'next/server';
import { normalizeUAC } from '@/lib/normalize-uac';
import { 
  withRetry, 
  healthTracker, 
  metrics, 
  dataCache, 
  uacCircuitBreaker 
} from '@/lib/self-healing';

export const dynamic = 'force-dynamic';
export const revalidate = 300;

const UAC_ZONES = [
  'salt-lake',
  'provo',
  'ogden',
  'skyline',
  'logan',
  'moab',
  'abajos',
  'veyo',
];

// Stale data fallback
const STALE_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

export async function GET() {
  try {
    const forecasts = [];

    for (const zone of UAC_ZONES) {
      try {
        // Use circuit breaker with retry
        const data = await uacCircuitBreaker.execute(async () => {
          return withRetry(async () => {
            const response = await fetch(
              `https://utahavalanchecenter.org/forecast/${zone}/json`,
              {
                headers: {
                  'Accept': 'application/json',
                  'User-Agent': 'Mozilla/5.0 (compatible; AvalancheDashboard/1.0)',
                },
                next: { revalidate: 300 },
              }
            );

            if (!response.ok) {
              throw new Error(`HTTP ${response.status}`);
            }

            return response.json();
          }, { maxRetries: 2, baseDelayMs: 1000, maxDelayMs: 5000 });
        });

        if (data) {
          const normalized = normalizeUAC(data);
          forecasts.push(...normalized);
          
          // Cache the successful data
          dataCache.set(`uac-${zone}`, normalized, false);
          metrics.recordCacheMiss(); // Fresh fetch
          healthTracker.recordSuccess('UAC');
        }
      } catch (error) {
        // Failed - try cache
        const cached = dataCache.get(`uac-${zone}`);
        if (cached) {
          forecasts.push(...(cached.data as typeof forecasts));
          metrics.recordCacheHit();
          
          const isStale = Date.now() - cached.timestamp > STALE_THRESHOLD_MS;
          if (isStale) {
            healthTracker.recordFailure('UAC', `Using stale cache for ${zone}: ${error}`);
          }
        } else {
          healthTracker.recordFailure('UAC', `Failed to fetch ${zone}: ${error}`);
        }
      }
    }

    // If we have no forecasts at all, return cached data with stale indicator
    if (forecasts.length === 0) {
      const allCached = dataCache.get('uac-all');
      if (allCached) {
        metrics.recordCacheHit();
        return NextResponse.json(allCached.data, {
          headers: {
            'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
            'X-Data-Stale': 'true',
            'X-Stale-Reason': 'Live fetch failed, serving cached data',
          },
        });
      }
      return NextResponse.json(
        { error: 'No UAC data available' },
        { status: 503 }
      );
    }

    // Cache all forecasts
    dataCache.set('uac-all', forecasts, false);

    return NextResponse.json(forecasts, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (error) {
    console.error('Error fetching UAC data:', error);
    metrics.recordFailure();
    return NextResponse.json(
      { error: 'Failed to fetch UAC data' },
      { status: 500 }
    );
  }
}
