'use client';

import { useState, useMemo, useEffect, Suspense, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { type UnifiedForecast, type AvalancheProblem, type DangerLevel, DANGER_COLORS, DANGER_LABELS } from '@/lib/types';
import { ZONE_COORDINATES } from '@/lib/zone-coordinates';

// Recharts components
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';

// Dynamic import to avoid SSR issues with Leaflet
const InteractiveMap = dynamic(
  () => import('@/components/InteractiveMap').then(mod => mod.default),
  { ssr: false, loading: () => <MapLoading /> }
);

function MapLoading() {
  return (
    <div className="w-full h-full bg-slate-800 flex items-center justify-center">
      <div className="text-slate-400 text-xl">Loading map...</div>
    </div>
  );
}

// Problems Table Component
function ProblemsTable({ problems }: { problems: AvalancheProblem[] }) {
  const [sortBy, setSortBy] = useState<'type' | 'likelihood' | 'size'>('type');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  const sortedProblems = useMemo(() => {
    return [...problems].sort((a, b) => {
      const aVal = a[sortBy] || '';
      const bVal = b[sortBy] || '';
      return sortOrder === 'asc'
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    });
  }, [problems, sortBy, sortOrder]);

  const handleSort = (field: 'type' | 'likelihood' | 'size') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };

  const likelihoodOrder = ['unlikely', 'possible', 'likely', 'very-likely'];
  const sizeOrder = ['small', 'large', 'very-large', 'historic'];

  return (
    <div className="bg-slate-800 rounded-lg overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-700">
            <th className="text-left p-3 text-slate-400 text-xs font-semibold uppercase tracking-wider cursor-pointer hover:text-white" onClick={() => handleSort('type')}>
              Type {sortBy === 'type' && (sortOrder === 'asc' ? '↑' : '↓')}
            </th>
            <th className="text-left p-3 text-slate-400 text-xs font-semibold uppercase tracking-wider cursor-pointer hover:text-white hidden md:table-cell" onClick={() => handleSort('likelihood')}>
              Likelihood {sortBy === 'likelihood' && (sortOrder === 'asc' ? '↑' : '↓')}
            </th>
            <th className="text-left p-3 text-slate-400 text-xs font-semibold uppercase tracking-wider cursor-pointer hover:text-white hidden lg:table-cell" onClick={() => handleSort('size')}>
              Size {sortBy === 'size' && (sortOrder === 'asc' ? '↑' : '↓')}
            </th>
            <th className="text-left p-3 text-slate-400 text-xs font-semibold uppercase tracking-wider hidden lg:table-cell">
              Aspects
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedProblems.map((problem, idx) => (
            <tr
              key={idx}
              className="border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors cursor-pointer"
              onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
            >
              <td className="p-3">
                <div className="flex items-center gap-2">
                  <span className="text-white text-sm font-medium">{problem.type}</span>
                  {expandedIdx === idx && (
                    <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  )}
                  {expandedIdx !== idx && (
                    <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  )}
                </div>
              </td>
              <td className="p-3 hidden md:table-cell">
                <span className={`text-xs px-2 py-1 rounded ${
                  likelihoodOrder.indexOf(problem.likelihood) >= 2
                    ? 'bg-red-900/50 text-red-300'
                    : likelihoodOrder.indexOf(problem.likelihood) === 1
                    ? 'bg-yellow-900/50 text-yellow-300'
                    : 'bg-slate-700 text-slate-300'
                }`}>
                  {problem.likelihood}
                </span>
              </td>
              <td className="p-3 hidden lg:table-cell">
                <span className="text-slate-300 text-sm">{problem.size}</span>
              </td>
              <td className="p-3 hidden lg:table-cell">
                <div className="flex gap-1 flex-wrap">
                  {problem.aspect?.slice(0, 3).map((asp, i) => (
                    <span key={i} className="text-xs bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded">{asp}</span>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Expanded Discussion */}
      {expandedIdx !== null && sortedProblems[expandedIdx] && (
        <div className="bg-slate-900/50 border-t border-slate-700 p-4">
          <h4 className="text-white text-sm font-semibold mb-2">{sortedProblems[expandedIdx].type} — Discussion</h4>
          <p className="text-slate-400 text-sm leading-relaxed">
            {sortedProblems[expandedIdx].discussion || 'No detailed discussion available for this problem.'}
          </p>
        </div>
      )}
    </div>
  );
}

// Danger Rose Component
function DangerRose({ forecasts }: { forecasts: UnifiedForecast[] }) {
  const [roseData, setRoseData] = useState<{ aspect: string; danger: number }[]>([]);

  useMemo(() => {
    const aspectDanger: Record<string, number[]> = {
      N: [], NE: [], E: [], SE: [], S: [], SW: [], W: [], NW: [],
    };

    forecasts.forEach(f => {
      f.avalancheProblems.forEach(p => {
        if (p.aspect) {
          p.aspect.forEach((asp: string) => {
            if (aspectDanger[asp]) {
              const lvl = f.dangerByElevation['Above Treeline'] ?? f.dangerRating;
              aspectDanger[asp].push(lvl);
            }
          });
        }
      });
    });

    const data = Object.entries(aspectDanger).map(([aspect, levels]) => ({
      aspect,
      danger: levels.length > 0 ? levels.reduce((a, b) => a + b, 0) / levels.length : 0,
    }));
    setRoseData(data);
  }, [forecasts]);

  return (
    <div className="bg-slate-800 rounded-lg p-4">
      <h3 className="text-white font-semibold mb-4">Aspect Risk</h3>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={roseData}>
            <PolarGrid stroke="#334155" />
            <PolarAngleAxis dataKey="aspect" tick={{ fill: '#94a3b8', fontSize: 12 }} />
            <PolarRadiusAxis angle={90} domain={[0, 5]} tick={{ fill: '#64748b', fontSize: 10 }} />
            <Radar
              name="Danger"
              dataKey="danger"
              stroke="#f97316"
              fill="#f97316"
              fillOpacity={0.4}
              strokeWidth={2}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '8px',
                color: '#f1f5f9',
              }}
              formatter={(value) => [value ? DANGER_LABELS[Math.round(value as number) as DangerLevel] : 'N/A', 'Avg Danger']}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// Timeline Chart Component
function TimelineChart({ forecasts }: { forecasts: UnifiedForecast[] }) {
  const [timelineData, setTimelineData] = useState<{ day: string; danger: number }[]>([]);

  useMemo(() => {
    const days = ['Today', 'Tomorrow', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7'];
    const data = days.map((day, i) => {
      const avgDanger = forecasts.length > 0
        ? forecasts.reduce((acc, f) => {
            const dayKey = i === 0 ? 'validDay' : `day${i}Rating`;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const rating = (f as any)[dayKey];
            return acc + (typeof rating === 'number' ? rating : f.dangerRating);
          }, 0) / forecasts.length
        : 1;
      return { day, danger: Math.round(avgDanger * 10) / 10 };
    });
    setTimelineData(data);
  }, [forecasts]);

  return (
    <div className="bg-slate-800 rounded-lg p-4">
      <h3 className="text-white font-semibold mb-4">7-Day Danger Trend</h3>
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={timelineData}>
            <defs>
              <linearGradient id="dangerGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f97316" stopOpacity={0.8}/>
                <stop offset="95%" stopColor="#f97316" stopOpacity={0.1}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis
              dataKey="day"
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              axisLine={{ stroke: '#475569' }}
            />
            <YAxis
              domain={[1, 5]}
              ticks={[1, 2, 3, 4, 5]}
              tick={{ fill: '#94a3b8', fontSize: 11 }}
              axisLine={{ stroke: '#475569' }}
              tickFormatter={(v) => DANGER_LABELS[v as DangerLevel]}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '8px',
                color: '#f1f5f9',
              }}
              formatter={(value) => [DANGER_LABELS[value as DangerLevel], 'Danger']}
            />
            <Area
              type="monotone"
              dataKey="danger"
              stroke="#f97316"
              fill="url(#dangerGradient)"
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// Zone Dropdown for header
function ZoneDropdown({
  zones,
  selectedZone,
  onSelect,
}: {
  zones: { zoneId: string; zone: string; center: 'CAIC' | 'UAC' }[];
  selectedZone: string | null;
  onSelect: (zoneId: string | null) => void;
}) {
  return (
    <select
      value={selectedZone ?? ''}
      onChange={e => onSelect(e.target.value || null)}
      className="bg-slate-700 border border-slate-600 rounded px-3 py-1.5 text-white text-sm focus:outline-none focus:border-blue-500 cursor-pointer"
    >
      <option value="">All Zones</option>
      <optgroup label="Utah (UAC)">
        {zones.filter(z => z.center === 'UAC').map(z => (
          <option key={z.zoneId} value={z.zoneId}>{z.zone}</option>
        ))}
      </optgroup>
      <optgroup label="Colorado (CAIC)">
        {zones.filter(z => z.center === 'CAIC').map(z => (
          <option key={z.zoneId} value={z.zoneId}>{z.zone}</option>
        ))}
      </optgroup>
    </select>
  );
}

// Dashboard Content Component
function DashboardContent({ forecasts }: { forecasts: UnifiedForecast[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedZone = searchParams.get('zone');

  const [showMapOnly, setShowMapOnly] = useState(false);
  const [currentZoom, setCurrentZoom] = useState<number | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [, forceRefresh] = useState(0);

  // Filter forecasts by selected zone
  const filteredForecasts = useMemo(() => {
    if (!selectedZone) return forecasts;
    return forecasts.filter(f => f.zoneId === selectedZone);
  }, [forecasts, selectedZone]);

  // Get zone list for dropdown
  const zoneList = useMemo(() => {
    return ZONE_COORDINATES.map(z => ({
      zoneId: z.zoneId,
      zone: z.zone,
      center: z.center,
    }));
  }, []);

  // Handle zone selection from map or dropdown
  const handleZoneSelect = useCallback((zoneId: string | null) => {
    if (zoneId) {
      router.push(`/dashboard?zone=${zoneId}`);
    } else {
      router.push('/dashboard');
    }
  }, [router]);

  // Handle zoom change — trigger data refresh
  const handleZoomChange = useCallback((zoom: number) => {
    setCurrentZoom(zoom);
    setLastRefresh(new Date());
    // Force a re-render to simulate data refresh
    forceRefresh(n => n + 1);
  }, []);

  // Aggregate problems from all filtered forecasts
  const allProblems = useMemo(() => {
    return filteredForecasts.flatMap(f => f.avalancheProblems);
  }, [filteredForecasts]);

  // Get selected zone name
  const selectedZoneName = useMemo(() => {
    if (!selectedZone) return 'All Zones';
    const zone = ZONE_COORDINATES.find(z => z.zoneId === selectedZone);
    return zone?.zone || selectedZone;
  }, [selectedZone]);

  if (showMapOnly) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col">
        {/* Header */}
        <header className="bg-slate-800 border-b border-slate-700 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-slate-400 hover:text-white transition-colors">
              ← Map Only
            </Link>
            <h1 className="text-white text-xl font-bold">Avalanche Map</h1>
          </div>
          <div className="flex items-center gap-3">
            {currentZoom !== null && (
              <span className="text-slate-500 text-xs">Zoom: {currentZoom}</span>
            )}
            <button
              onClick={() => setShowMapOnly(false)}
              className="text-blue-400 hover:text-blue-300 text-sm"
            >
              View Combined →
            </button>
          </div>
        </header>

        {/* Map */}
        <main className="flex-1 relative">
          <div className="absolute inset-0 pt-14">
            <InteractiveMap
              forecasts={forecasts}
              selectedZoneId={selectedZone}
              onZoneSelect={handleZoneSelect}
              onZoomChange={handleZoomChange}
            />
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-slate-400 hover:text-white transition-colors">
            ← Home
          </Link>
          <h1 className="text-white text-xl font-bold">Avalanche Dashboard</h1>
          {selectedZone && (
            <span className="text-blue-400 text-sm">/ {selectedZoneName}</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {/* Compact Zone Selector */}
          <ZoneDropdown
            zones={zoneList}
            selectedZone={selectedZone}
            onSelect={handleZoneSelect}
          />
          {/* Zoom refresh indicator */}
          {currentZoom !== null && (
            <span className="text-slate-500 text-xs" title={`Refreshed at ${lastRefresh.toLocaleTimeString()}`}>
              zoom {currentZoom}
            </span>
          )}
          <span className="text-slate-400 text-sm">
            {filteredForecasts.length} zone{filteredForecasts.length !== 1 ? 's' : ''}
          </span>
          <button
            onClick={() => setShowMapOnly(true)}
            className="text-blue-400 hover:text-blue-300 text-sm"
          >
            Map Only →
          </button>
        </div>
      </header>

      {/* Full-width Map — no overlay blocking it */}
      <div className="relative h-[55vh] min-h-[400px]">
        <InteractiveMap
          forecasts={forecasts}
          selectedZoneId={selectedZone}
          onZoneSelect={handleZoneSelect}
          onZoomChange={handleZoomChange}
        />
      </div>

      {/* Scrollable Bottom Section */}
      <main className="flex-1 overflow-y-auto p-4 lg:p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Section Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-white text-lg font-semibold">
              {selectedZone ? `${selectedZoneName} Details` : 'All Zones Overview'}
            </h2>
            {selectedZone && (
              <button
                onClick={() => router.push('/dashboard')}
                className="text-slate-400 hover:text-white text-sm"
              >
                Clear filter ×
              </button>
            )}
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-slate-800 rounded-lg p-4">
              <div className="text-slate-400 text-sm mb-1">Zones</div>
              <div className="text-white text-2xl font-bold">{filteredForecasts.length}</div>
            </div>
            <div className="bg-slate-800 rounded-lg p-4">
              <div className="text-slate-400 text-sm mb-1">Avg Danger</div>
              <div className="text-amber-400 text-2xl font-bold">
                {filteredForecasts.length > 0
                  ? (filteredForecasts.reduce((acc, f) => acc + f.dangerRating, 0) / filteredForecasts.length).toFixed(1)
                  : 'N/A'}
              </div>
            </div>
            <div className="bg-slate-800 rounded-lg p-4">
              <div className="text-slate-400 text-sm mb-1">Problems</div>
              <div className="text-white text-2xl font-bold">{allProblems.length}</div>
            </div>
            <div className="bg-slate-800 rounded-lg p-4">
              <div className="text-slate-400 text-sm mb-1">High Danger</div>
              <div className="text-red-400 text-2xl font-bold">
                {filteredForecasts.filter(f => f.dangerRating >= 4).length}
              </div>
            </div>
          </div>

          {/* Main Content Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Problems Table - Takes 2 columns on large screens */}
            <div className="lg:col-span-2">
              <h3 className="text-white font-semibold mb-3">Avalanche Problems</h3>
              <ProblemsTable problems={allProblems} />
            </div>

            {/* Danger Rose - Takes 1 column */}
            <div>
              <h3 className="text-white font-semibold mb-3">Danger Rose</h3>
              <DangerRose forecasts={filteredForecasts} />
            </div>
          </div>

          {/* Timeline */}
          <div>
            <h3 className="text-white font-semibold mb-3">7-Day Timeline</h3>
            <TimelineChart forecasts={filteredForecasts} />
          </div>

          {/* Footer */}
          <div className="text-slate-500 text-xs text-center py-4 border-t border-slate-800">
            Data from CAIC (Colorado) and UAC (Utah) • Updated: {lastRefresh.toLocaleTimeString()}
          </div>
        </div>
      </main>
    </div>
  );
}

// Loading fallback
function DashboardLoading() {
  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-slate-400 text-xl">Loading dashboard...</div>
    </div>
  );
}

// Main page component with Suspense for useSearchParams
export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardLoading />}>
      <DashboardContentWithData />
    </Suspense>
  );
}

// Wrapper component to fetch data
function DashboardContentWithData() {
  const [forecasts, setForecasts] = useState<UnifiedForecast[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
    return <DashboardLoading />;
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-red-400 text-xl">Error: {error}</div>
      </div>
    );
  }

  return <DashboardContent forecasts={forecasts} />;
}
