import { NextResponse } from 'next/server';
import { fetchCAICData } from '@/lib/normalize-caic';
import { 
  withRetry, 
  healthTracker, 
  metrics, 
  dataCache, 
  caicCircuitBreaker,
  driftDetector 
} from '@/lib/self-healing';

export const dynamic = 'force-dynamic';
export const revalidate = 300;

const STALE_THRESHOLD_MS = 10 * 60 * 1000;

export async function GET() {
  try {
    // Use circuit breaker with retry
    const data = await caicCircuitBreaker.execute(async () => {
      return withRetry(async () => {
        return await fetchCAICData();
      }, { maxRetries: 2, baseDelayMs: 1000, maxDelayMs: 5000 });
    });

    if (data && data.length > 0) {
      // Validate against schema
      for (const forecast of data) {
        const validation = driftDetector.validate(forecast, 'CAIC');
        if (!validation.valid) {
          console.warn('CAIC schema drift detected:', validation.errors);
          healthTracker.recordFailure('CAIC', `Schema drift: ${JSON.stringify(validation.errors)}`);
        }
      }

      // Cache successful data
      dataCache.set('caic', data, false);
      metrics.recordCacheMiss();
      healthTracker.recordSuccess('CAIC');

      return NextResponse.json(data, {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        },
      });
    }

    // No data from CAIC, try cache
    const cached = dataCache.get('caic');
    if (cached) {
      metrics.recordCacheHit();
      const isStale = Date.now() - cached.timestamp > STALE_THRESHOLD_MS;
      
      return NextResponse.json(cached.data, {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
          ...(isStale ? { 'X-Data-Stale': 'true' } : {}),
        },
      });
    }

    return NextResponse.json(
      { error: 'No CAIC data available' },
      { status: 503 }
    );
  } catch (error) {
    console.error('Error fetching CAIC data:', error);
    
    // Circuit breaker is open or fetch failed
    const cached = dataCache.get('caic');
    if (cached) {
      metrics.recordCacheHit();
      healthTracker.recordFailure('CAIC', `Circuit breaker open, using cache: ${error}`);
      
      return NextResponse.json(cached.data, {
        headers: {
          'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
          'X-Data-Stale': 'true',
          'X-Stale-Reason': 'Circuit breaker open, serving cached data',
        },
      });
    }

    metrics.recordFailure();
    return NextResponse.json(
      { error: 'Failed to fetch CAIC data' },
      { status: 500 }
    );
  }
}
