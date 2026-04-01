import { NextResponse } from 'next/server';
import { fetchCAICData } from '@/lib/normalize-caic';
import { normalizeUAC } from '@/lib/normalize-uac';
import { 
  withRetry, 
  healthTracker, 
  metrics, 
  dataCache, 
  uacCircuitBreaker, 
  caicCircuitBreaker,
  driftDetector
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

const STALE_THRESHOLD_MS = 10 * 60 * 1000;

export async function GET() {
  try {
    // Fetch CAIC and UAC data in parallel with self-healing
    const [caicResult, uacResults] = await Promise.allSettled([
      // CAIC with circuit breaker
      caicCircuitBreaker.execute(async () => {
        return withRetry(async () => {
          const data = await fetchCAICData();
          
          // Validate incoming data
          for (const forecast of data) {
            const validation = driftDetector.validate(forecast, 'CAIC');
            if (!validation.valid) {
              console.warn('CAIC schema drift detected:', validation.errors);
            }
          }
          
          return data;
        }, { maxRetries: 2, baseDelayMs: 1000, maxDelayMs: 5000 });
      }),
      
      // UAC zones with circuit breaker
      Promise.all(
        UAC_ZONES.map(async (zone) => {
          return uacCircuitBreaker.execute(async () => {
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
              if (response.ok) {
                return normalizeUAC(await response.json());
              }
              throw new Error(`HTTP ${response.status}`);
            }, { maxRetries: 2, baseDelayMs: 1000, maxDelayMs: 5000 });
          });
        })
      ),
    ]);

    const caicData = caicResult.status === 'fulfilled' ? caicResult.value : [];
    const uacData = uacResults.status === 'fulfilled' 
      ? uacResults.value.flat().filter(Boolean) 
      : [];

    // Track metrics
    if (caicResult.status === 'fulfilled') {
      metrics.recordCacheMiss();
      healthTracker.recordSuccess('CAIC');
      dataCache.set('caic', caicData, false);
    } else {
      metrics.recordCacheHit();
      healthTracker.recordFailure('CAIC', String(caicResult.reason));
      
      // Try cached CAIC data
      const cachedCaic = dataCache.get('caic');
      if (cachedCaic) {
        caicData.push(...(cachedCaic.data as typeof caicData));
      }
    }

    if (uacResults.status === 'fulfilled' && uacData.length > 0) {
      metrics.recordCacheMiss();
      healthTracker.recordSuccess('UAC');
      dataCache.set('uac-all', uacData, false);
    } else {
      // Try cached UAC data
      const cachedUac = dataCache.get('uac-all');
      if (cachedUac) {
        uacData.push(...(cachedUac.data as typeof uacData));
        metrics.recordCacheHit();
      }
      healthTracker.recordFailure('UAC', 'Some zones failed');
    }

    const allForecasts = [...caicData, ...uacData];

    // If we have no forecasts at all, return error
    if (allForecasts.length === 0) {
      return NextResponse.json(
        { error: 'No forecast data available from any source' },
        { status: 503 }
      );
    }

    return NextResponse.json(allForecasts, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
        'X-Forecast-Count': String(allForecasts.length),
        'X-CAIC-Zones': String(caicData.length),
        'X-UAC-Zones': String(uacData.length),
      },
    });
  } catch (error) {
    console.error('Error fetching forecast data:', error);
    metrics.recordFailure();
    return NextResponse.json(
      { error: 'Failed to fetch forecast data' },
      { status: 500 }
    );
  }
}
