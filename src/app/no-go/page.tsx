import { ZONE_COORDINATES } from '@/lib/zone-coordinates';
import NoGoClient from './NoGoClient';

interface Props {
  searchParams: Promise<{ zone?: string }>;
}

export const metadata = {
  title: 'Go / No-Go — Avalanche Forecast',
  description: 'Should you go? Get a go/no-go recommendation based on avalanche danger and weather at treeline.',
};

export default async function NoGoPage({ searchParams }: Props) {
  const { zone: zoneId } = await searchParams;

  // Fetch forecasts from our own API route (server-to-server)
  let forecasts: unknown[] = [];
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000';
    const res = await fetch(`${baseUrl}/api/forecast/all`, {
      next: { revalidate: 300 },
    });
    if (res.ok) {
      const data = await res.json();
      forecasts = data.forecasts ?? [];
    }
  } catch {
    forecasts = [];
  }

  // Build zone list with coordinates
  const zones = ZONE_COORDINATES.map(coords => ({
    zoneId: coords.zoneId,
    zone: coords.zone,
    center: coords.center,
    lat: coords.lat,
    lon: coords.lng,
  }));

  const selectedZone = zoneId ? zones.find(z => z.zoneId === zoneId) : null;

  // Fetch weather from Open-Meteo for selected zone
  let weather: Record<string, unknown> | null = null;
  if (selectedZone) {
    try {
      const { lat, lon } = selectedZone;
      const params = new URLSearchParams({
        latitude: lat.toString(),
        longitude: lon.toString(),
        hourly: 'temperature_2m,precipitation,snowfall,windspeed_10m,winddirection_10m,weathercode',
        current_weather: 'true',
        timezone: 'auto',
        forecast_days: '2',
      });
      const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`, {
        next: { revalidate: 300 },
      });
      if (res.ok) weather = await res.json();
    } catch {
      weather = null;
    }
  }

  return (
    <NoGoClient
      forecasts={forecasts as Parameters<typeof NoGoClient>[0]['forecasts']}
      zones={zones}
      selectedZoneId={zoneId ?? null}
      weather={weather as Parameters<typeof NoGoClient>[0]['weather']}
    />
  );
}
