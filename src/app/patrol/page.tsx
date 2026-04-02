'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { PatrolZoneView, DENSITY_THRESHOLDS } from '@/lib/checkInTypes';
import { ZONE_COORDINATES } from '@/lib/zone-coordinates';
import { useUserLocation } from '@/hooks/useUserLocation';
import { sortByDistance, formatDistance, isUSLocale, haversineDistance } from '@/lib/proximity';

// 15-zone colors matching the map dots
const ZONE_COLORS: Record<string, string> = {
  'caic-steamboat': '#06b6d4',    // cyan
  'caic-front-range': '#8b5cf6',  // violet
  'caic-vail': '#3b82f6',         // blue
  'caic-aspen': '#ec4899',        // pink
  'caic-grand-mesa': '#f59e0b',   // amber
  'caic-gunnison': '#ef4444',     // red
  'caic-nw-san-juan': '#10b981',  // emerald
  'caic-sw-san-juan': '#14b8a6',  // teal
  'uac-logan': '#8b5cf6',         // violet
  'uac-ogden': '#06b6d4',         // cyan
  'uac-salt-lake': '#3b82f6',    // blue
  'uac-provo': '#10b981',         // emerald
  'uac-skyline': '#f59e0b',       // amber
  'uac-moab': '#ef4444',          // red
  'uac-abajo': '#ec4899',         // pink
};

const ZONES = ZONE_COORDINATES.map(({ zoneId, zone }) => ({
  id: zoneId,
  name: zone,
  color: ZONE_COLORS[zoneId] ?? '#6b7280',
}));

const DENSITY_COLORS = {
  low: 'bg-emerald-500',
  moderate: 'bg-yellow-500',
  high: 'bg-orange-500',
  critical: 'bg-red-600',
};

const DENSITY_BG = {
  low: 'bg-emerald-500/10 border-emerald-500/30',
  moderate: 'bg-yellow-500/10 border-yellow-500/30',
  high: 'bg-orange-500/10 border-orange-500/30',
  critical: 'bg-red-600/10 border-red-600/30',
};

type SortOrder = 'default' | 'nearest' | 'farthest';

function ZoneCard({ zone, userLat, userLng, useImperial }: { 
  zone: PatrolZoneView & { name: string; color: string }; 
  userLat: number;
  userLng: number;
  useImperial: boolean;
}) {
  const zoneCoords = ZONE_COORDINATES.find(z => z.zoneId === zone.zoneId);
  const distance = zoneCoords && userLat !== 0 
    ? haversineDistance(userLat, userLng, zoneCoords.lat, zoneCoords.lng)
    : null;

  return (
    <div className={`rounded-xl p-4 border ${DENSITY_BG[zone.densityStatus]}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: zone.color }}
          />
          <h3 className="font-semibold text-slate-100">{zone.name}</h3>
          {distance !== null && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700/50 text-slate-300">
              {formatDistance(distance, useImperial)}
            </span>
          )}
        </div>
        <span className={`text-xs px-2 py-1 rounded-full text-white ${DENSITY_COLORS[zone.densityStatus]} ${zone.densityStatus === 'critical' ? 'animate-pulse' : ''}`}>
          {zone.densityStatus.toUpperCase()}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-slate-400 text-xs mb-0.5">Active</p>
          <p className="text-2xl font-bold text-slate-100">{zone.activeCount}</p>
        </div>
        <div>
          <p className="text-slate-400 text-xs mb-0.5">Overdue</p>
          <p className={`text-2xl font-bold ${zone.overdueCount > 0 ? 'text-red-400' : 'text-slate-100'}`}>
            {zone.overdueCount}
          </p>
        </div>
      </div>

      <div className="mt-2 pt-2 border-t border-slate-700/50">
        <div className="flex justify-between text-xs text-slate-400">
          <span>⚠️ {zone.dangerRating}/5</span>
          <span>{new Date(zone.lastUpdated).toLocaleTimeString()}</span>
        </div>
      </div>
    </div>
  );
}

export default function PatrolDashboard() {
  const [zones, setZones] = useState<(PatrolZoneView & { name: string; color: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [sortOrder, setSortOrder] = useState<SortOrder>('default');
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  
  const { lat: userLat, lng: userLng, loading: locationLoading, refresh: refreshLocation } = useUserLocation();
  const useImperial = isUSLocale();

  async function fetchZones() {
    setRefreshing(true);
    try {
      const results = await Promise.all(
        ZONES.map(async (z) => {
          const res = await fetch(`/api/patrol/zones/${z.id}`);
          if (!res.ok) return null;
          const data: PatrolZoneView = await res.json();
          return { ...data, name: z.name, color: z.color };
        })
      );
      setZones(results.filter(Boolean) as (PatrolZoneView & { name: string; color: string })[]);
      setLastRefresh(new Date());
    } catch (error) {
      console.error('Failed to fetch zone data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    fetchZones();
    const interval = setInterval(fetchZones, 30000);
    return () => clearInterval(interval);
  }, []);

  const totalActive = zones.reduce((sum, z) => sum + z.activeCount, 0);
  const totalOverdue = zones.reduce((sum, z) => sum + z.overdueCount, 0);

  // Sort zones if proximity sorting is enabled
  const sortedZones = sortOrder === 'default' || userLat === 0
    ? zones
    : sortByDistance(
        zones,
        userLat,
        userLng,
        (z) => {
          const coords = ZONE_COORDINATES.find(coord => coord.zoneId === z.zoneId);
          return [coords?.lat ?? 0, coords?.lng ?? 0];
        }
      );

  return (
    <div className="flex flex-col min-h-screen bg-slate-900 text-slate-100">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700 px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-100">🚁 Patrol Dashboard</h1>
            <p className="text-xs text-slate-400">Anonymous density · auto-refreshes 30s</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Sort Toggle */}
            {!locationLoading && userLat !== 0 && (
              <button
                onClick={() => setSortOrder(sortOrder === 'default' ? 'nearest' : sortOrder === 'nearest' ? 'farthest' : 'default')}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                  sortOrder !== 'default'
                    ? 'bg-emerald-600/30 text-emerald-300 border border-emerald-500/30'
                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                }`}
              >
                <span>📍</span>
                <span>
                  {sortOrder === 'default' && 'Sort'}
                  {sortOrder === 'nearest' && 'Nearest'}
                  {sortOrder === 'farthest' && 'Farthest'}
                </span>
              </button>
            )}
            <div className="text-right">
              <p className="text-xs text-slate-400">Total</p>
              <p className="text-2xl font-bold text-emerald-400">{totalActive}</p>
              {totalOverdue > 0 && (
                <p className="text-xs text-red-400">{totalOverdue} overdue</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 pb-24">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-slate-400">Loading...</div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3">
              {sortedZones.map((zone) => (
                <ZoneCard key={zone.zoneId} zone={zone} userLat={userLat} userLng={userLng} useImperial={useImperial} />
              ))}
            </div>

            {/* Legend */}
            <div className="mt-6 bg-slate-800 rounded-xl p-4 border border-slate-700">
              <h2 className="text-sm font-semibold text-slate-200 mb-3">Density Legend</h2>
              <div className="grid grid-cols-2 gap-2 text-xs">
                {(['moderate', 'high', 'critical'] as const).map((level) => (
                  <div key={level} className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${DENSITY_COLORS[level]}`} />
                    <span className="text-slate-300 capitalize">{level}</span>
                    <span className="text-slate-500">
                      ({DENSITY_THRESHOLDS[3][level]}+)
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 bg-slate-800 border-t border-slate-700 flex safe-area-inset-bottom">
        <a href="/check-in" className="flex-1 flex flex-col items-center py-3 text-slate-400">
          <span className="text-xl mb-0.5">📍</span>
          <span className="text-xs font-medium">Check In</span>
        </a>
        <Link href="/" className="flex-1 flex flex-col items-center py-3 text-slate-400">
          <span className="text-xl mb-0.5">🗺️</span>
          <span className="text-xs font-medium">Map</span>
        </Link>
        <Link href="/dashboard" className="flex-1 flex flex-col items-center py-3 text-slate-400">
          <span className="text-xl mb-0.5">📊</span>
          <span className="text-xs font-medium">Data</span>
        </Link>
        <Link href="/patrol" className="flex-1 flex flex-col items-center py-3 text-blue-400">
          <span className="text-xl mb-0.5">🚁</span>
          <span className="text-xs font-medium">Patrol</span>
        </Link>
      </nav>

      <style>{`
        .safe-area-inset-bottom {
          padding-bottom: env(safe-area-inset-bottom, 0);
        }
      `}</style>
    </div>
  );
}
