'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { type UnifiedForecast } from '@/lib/types';

// Dynamic import to avoid SSR issues with Leaflet
const InteractiveMap = dynamic(
  () => import('@/components/InteractiveMap').then(mod => mod.default),
  { ssr: false, loading: () => <MapLoading /> }
);

function MapLoading() {
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-slate-400 text-xl">Loading map...</div>
    </div>
  );
}

export default function MapPage() {
  const [forecasts, setForecasts] = useState<UnifiedForecast[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch('/api/forecast/all');
        if (response.ok) {
          const data = await response.json();
          setForecasts(data);
        } else {
          throw new Error('Failed to fetch forecasts');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return <MapLoading />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-red-400 text-xl">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-slate-400 hover:text-white transition-colors">
            ← Dashboard
          </Link>
          <h1 className="text-white text-xl font-bold">Avalanche Map</h1>
        </div>
        <div className="text-slate-400 text-sm">
          {forecasts.length} zones • Colorado & Utah
        </div>
      </header>

      {/* Map */}
      <main className="flex-1 relative">
        <div className="absolute inset-0 pt-16">
          <InteractiveMap
            forecasts={forecasts}
            selectedZoneId={selectedZoneId}
            onZoneSelect={setSelectedZoneId}
          />
        </div>
      </main>
    </div>
  );
}
