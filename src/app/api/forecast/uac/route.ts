import { NextResponse } from 'next/server';
import { normalizeUAC } from '@/lib/normalize-uac';

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

export async function GET() {
  try {
    const forecasts = [];

    for (const zone of UAC_ZONES) {
      try {
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
          const data = await response.json();
          forecasts.push(...normalizeUAC(data));
        }
      } catch {
        // Skip zones that fail
      }
    }

    return NextResponse.json(forecasts, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (error) {
    console.error('Error fetching UAC data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch UAC data' },
      { status: 500 }
    );
  }
}
