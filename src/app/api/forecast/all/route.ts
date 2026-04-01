import { NextResponse } from 'next/server';
import { fetchCAICData } from '@/lib/normalize-caic';
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
    // Fetch CAIC and UAC data in parallel
    const [caicForecasts, uacResults] = await Promise.allSettled([
      fetchCAICData(),
      Promise.all(
        UAC_ZONES.map(async (zone) => {
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
          return [];
        })
      ),
    ]);

    const caicData = caicForecasts.status === 'fulfilled' ? caicForecasts.value : [];
    const uacData = uacResults.status === 'fulfilled' 
      ? uacResults.value.flat() 
      : [];

    const allForecasts = [...caicData, ...uacData];

    return NextResponse.json(allForecasts, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (error) {
    console.error('Error fetching forecast data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch forecast data' },
      { status: 500 }
    );
  }
}
