'use client';

import { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { type UnifiedForecast } from '@/lib/types';
import { ZONE_COORDINATES } from '@/lib/zone-coordinates';
import { useUserLocation } from '@/hooks/useUserLocation';
import { sortByDistance, formatDistance, isUSLocale, haversineDistance } from '@/lib/proximity';

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

type SortOrder = 'nearest' | 'farthest' | 'default';

export default function MapPage() {
  const [forecasts, setForecasts] = useState<UnifiedForecast[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>('default');
  const [showLocationPrompt, setShowLocationPrompt] = useState(false);
  const { lat: userLat, lng: userLng, loading: locationLoading, error: locationError, refresh: refreshLocation } = useUserLocation();

  const useImperial = isUSLocale();

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

  // Show location prompt when we have location
  useEffect(() => {
    if (!locationLoading && userLat !== 0 && userLng !== 0 && sortOrder === 'default') {
      setShowLocationPrompt(true);
    }
  }, [locationLoading, userLat, userLng, sortOrder]);

  // Get sorted zone data
  const sortedZoneData = useMemo(() => {
    if (sortOrder === 'default' || userLat === 0 || userLng === 0) {
      return ZONE_COORDINATES.map(coord => {
        const forecast = forecasts.find(f => f.zoneId === coord.zoneId || f.zone === coord.zone);
        return {
          ...coord,
          forecast,
          dangerRating: forecast?.dangerRating || 1,
          distance: null,
        };
      });
    }

    const sorted = sortByDistance(
      ZONE_COORDINATES,
      userLat,
      userLng,
      (z) => [z.lat, z.lng]
    );

    return sorted.map((coord) => {
      const forecast = forecasts.find(f => f.zoneId === coord.zoneId || f.zone === coord.zone);
      const distance = haversineDistance(userLat, userLng, coord.lat, coord.lng);
      return {
        ...coord,
        forecast,
        dangerRating: forecast?.dangerRating || 1,
        distance,
      };
    });
  }, [forecasts, sortOrder, userLat, userLng]);

  // Get sorted forecasts based on sort order
  const sortedForecasts = useMemo(() => {
    if (sortOrder === 'default' || userLat === 0 || userLng === 0) {
      return forecasts;
    }

    return sortByDistance(
      forecasts,
      userLat,
      userLng,
      (f) => {
        const zone = ZONE_COORDINATES.find(z => z.zoneId === f.zoneId || z.zone === f.zone);
        return [zone?.lat ?? 0, zone?.lng ?? 0];
      }
    );
  }, [forecasts, sortOrder, userLat, userLng]);

  const handleSortToggle = () => {
    if (sortOrder === 'default') {
      setSortOrder('nearest');
    } else if (sortOrder === 'nearest') {
      setSortOrder('farthest');
    } else {
      setSortOrder('default');
    }
  };

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
        <div className="flex items-center gap-4">
          <span className="text-slate-400 text-sm">
            {forecasts.length} zones • Colorado & Utah
          </span>
          {/* Sort Toggle */}
          <button
            onClick={handleSortToggle}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors ${
              sortOrder !== 'default'
                ? 'bg-blue-600 text-white hover:bg-blue-500'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
            title={sortOrder === 'default' ? 'Sort by distance' : `Sorted: ${sortOrder}`}
          >
            <span>📍</span>
            <span>
              {sortOrder === 'default' && 'Sort'}
              {sortOrder === 'nearest' && 'Nearest'}
              {sortOrder === 'farthest' && 'Farthest'}
            </span>
            {sortOrder !== 'default' && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSortOrder('default');
                }}
                className="ml-1 text-blue-200 hover:text-white"
              >
                ×
              </button>
            )}
          </button>
        </div>
      </header>

      {/* Location Info Bar */}
      {(sortOrder !== 'default' || showLocationPrompt) && userLat !== 0 && (
        <div className="bg-slate-800/80 border-b border-slate-700 px-4 py-2 flex items-center justify-between text-sm">
          <div className="flex items-center gap-2">
            <span className="text-emerald-400">📍</span>
            <span className="text-slate-300">
              {locationLoading ? 'Getting your location...' : 'Your location'}
            </span>
            {locationError && !locationLoading && (
              <span className="text-amber-400 text-xs">({locationError})</span>
            )}
          </div>
          <button
            onClick={refreshLocation}
            className="text-blue-400 hover:text-blue-300 text-xs"
          >
            Refresh
          </button>
        </div>
      )}

      {/* Zone List with Distances (when sorted) */}
      {sortOrder !== 'default' && userLat !== 0 && sortedZoneData.length > 0 && (
        <div className="bg-slate-800/50 border-b border-slate-700 max-h-48 overflow-y-auto">
          <div className="flex items-center gap-2 px-4 py-2 text-xs text-slate-400">
            <span>
              {sortOrder === 'nearest' ? '↑ Nearest first' : '↓ Farthest first'}
            </span>
          </div>
          <div className="flex gap-2 px-4 pb-2 overflow-x-auto">
            {sortedZoneData.slice(0, 15).map((zone, idx) => (
              <div
                key={zone.zoneId}
                className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-sm ${
                  idx === 0
                    ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/30'
                    : 'bg-slate-700/50 text-slate-300'
                }`}
              >
                <div className="font-medium">{zone.zone.split(' ')[0]}</div>
                <div className="text-xs opacity-75">
                  {zone.distance !== null && formatDistance(zone.distance, useImperial)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Map */}
      <main className="flex-1 relative">
        <div className="absolute inset-0 pt-16">
          <InteractiveMap
            forecasts={sortedForecasts}
            selectedZoneId={selectedZoneId}
            onZoneSelect={setSelectedZoneId}
          />
        </div>
      </main>
    </div>
  );
}
