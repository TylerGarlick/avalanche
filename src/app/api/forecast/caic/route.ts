import { NextResponse } from 'next/server';
import { fetchCAICData } from '@/lib/normalize-caic';

export const dynamic = 'force-dynamic';
export const revalidate = 300;

export async function GET() {
  try {
    const data = await fetchCAICData();
    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (error) {
    console.error('Error fetching CAIC data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch CAIC data' },
      { status: 500 }
    );
  }
}
