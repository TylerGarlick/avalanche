import { NextResponse } from 'next/server';
import { driftDetector, healthTracker, dataCache } from '@/lib/self-healing';
import { normalizeUAC } from '@/lib/normalize-uac';
import { fetchCAICData } from '@/lib/normalize-caic';
import { UnifiedForecast } from '@/lib/types';

export const dynamic = 'force-dynamic';

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

interface ValidationSourceResult {
  source: string;
  status: 'pass' | 'fail';
  zoneCount?: number;
  errors: Array<{
    field: string;
    expected: string;
    received: string;
    zone?: string;
  }>;
  timestamp: string;
}

export async function GET() {
  const results: ValidationSourceResult[] = [];
  let overallStatus: 'pass' | 'fail' = 'pass';

  // Validate UAC data
  try {
    const uacForecasts: UnifiedForecast[] = [];

    for (const zone of UAC_ZONES) {
      const response = await fetch(
        `https://utahavalanchecenter.org/forecast/${zone}/json`,
        {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0 (compatible; AvalancheDashboard/1.0)',
          },
          cache: 'no-store',
        }
      );

      if (response.ok) {
        const data = await response.json();
        uacForecasts.push(...normalizeUAC(data));
      }
    }

    // Validate each forecast
    const uacErrors: ValidationSourceResult['errors'] = [];
    for (const forecast of uacForecasts) {
      const validation = driftDetector.validate(forecast, 'UAC');
      if (!validation.valid) {
        for (const error of validation.errors) {
          uacErrors.push({
            ...error,
            zone: forecast.zone,
          });
        }
      }
    }

    if (uacErrors.length > 0) {
      overallStatus = 'fail';
    }

    results.push({
      source: 'UAC',
      status: uacErrors.length === 0 ? 'pass' : 'fail',
      zoneCount: uacForecasts.length,
      errors: uacErrors,
      timestamp: new Date().toISOString(),
    });

    healthTracker.recordSuccess('UAC');
  } catch (error) {
    overallStatus = 'fail';
    results.push({
      source: 'UAC',
      status: 'fail',
      errors: [
        {
          field: 'fetch',
          expected: 'successful response',
          received: error instanceof Error ? error.message : 'Unknown error',
        },
      ],
      timestamp: new Date().toISOString(),
    });
    healthTracker.recordFailure('UAC', error instanceof Error ? error.message : 'Unknown error');
  }

  // Validate CAIC data
  try {
    const caicForecasts = await fetchCAICData();

    const caicErrors: ValidationSourceResult['errors'] = [];
    for (const forecast of caicForecasts) {
      const validation = driftDetector.validate(forecast, 'CAIC');
      if (!validation.valid) {
        for (const error of validation.errors) {
          caicErrors.push({
            ...error,
            zone: forecast.zone,
          });
        }
      }
    }

    if (caicErrors.length > 0) {
      overallStatus = 'fail';
    }

    results.push({
      source: 'CAIC',
      status: caicErrors.length === 0 ? 'pass' : 'fail',
      zoneCount: caicForecasts.length,
      errors: caicErrors,
      timestamp: new Date().toISOString(),
    });

    healthTracker.recordSuccess('CAIC');
  } catch (error) {
    overallStatus = 'fail';
    results.push({
      source: 'CAIC',
      status: 'fail',
      errors: [
        {
          field: 'fetch',
          expected: 'successful response',
          received: error instanceof Error ? error.message : 'Unknown error',
        },
      ],
      timestamp: new Date().toISOString(),
    });
    healthTracker.recordFailure('CAIC', error instanceof Error ? error.message : 'Unknown error');
  }

  // Get drift history
  const driftHistory = driftDetector.getValidationHistory().slice(-10);

  return NextResponse.json(
    {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      sources: results,
      driftHistory,
      summary: {
        totalSources: results.length,
        passingSources: results.filter(r => r.status === 'pass').length,
        failingSources: results.filter(r => r.status === 'fail').length,
        totalErrors: results.reduce((sum, r) => sum + r.errors.length, 0),
      },
    },
    {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    }
  );
}
