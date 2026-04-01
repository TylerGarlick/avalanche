'use client';

import { useState, useMemo, useEffect, Suspense } from 'react';
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
  CartesianAxis,
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

// Zone Selector Tabs Component
function ZoneSelectorTabs({ 
  zones, 
  selectedZone, 
  onSelect 
}: { 
  zones: { zoneId: string; zone: string; center: 'CAIC' | 'UAC' }[];
  selectedZone: string | null;
  onSelect: (zoneId: string | null) => void;
}) {
  const caicZones = zones.filter(z => z.center === 'CAIC');
  const uacZones = zones.filter(z => z.center === 'UAC');

  return (
    <div className="absolute top-4 right-4 bg-slate-900/95 rounded-lg p-3 z-[1000] shadow-lg max-w-xs">
      <div className="text-white text-sm font-semibold mb-2">Select Zone</div>
      
      {/* All Zones Button */}
      <button
        onClick={() => onSelect(null)}
        className={`w-full text-left px-3 py-2 rounded text-sm mb-2 transition-colors ${
          selectedZone === null 
            ? 'bg-blue-600 text-white' 
            : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
        }`}
      >
        All Zones
      </button>

      {/* CAIC Zones */}
      <div className="mb-2">
        <div className="text-blue-400 text-xs font-semibold mb-1 px-1">Colorado (CAIC)</div>
        <div className="max-h-32 overflow-y-auto space-y-1">
          {caicZones.map(zone => (
            <button
              key={zone.zoneId}
              onClick={() => onSelect(zone.zoneId)}
              className={`w-full text-left px-3 py-1.5 rounded text-xs transition-colors ${
                selectedZone === zone.zoneId 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-slate-700/50 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {zone.zone}
            </button>
          ))}
        </div>
      </div>

      {/* UAC Zones */}
      <div>
        <div className="text-green-400 text-xs font-semibold mb-1 px-1">Utah (UAC)</div>
        <div className="max-h-32 overflow-y-auto space-y-1">
          {uacZones.map(zone => (
            <button
              key={zone.zoneId}
              onClick={() => onSelect(zone.zoneId)}
              className={`w-full text-left px-3 py-1.5 rounded text-xs transition-colors ${
                selectedZone === zone.zoneId 
                  ? 'bg-green-600 text-white' 
                  : 'bg-slate-700/50 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {zone.zone}
            </button>
          ))}
        </div>
      </div>
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

  const getLikelihoodSortValue = (l: string) => likelihoodOrder.indexOf(l.toLowerCase()) ?? 99;
  const getSizeSortValue = (s: string) => sizeOrder.indexOf(s.toLowerCase()) ?? 99;

  const sortedByLikelihood = useMemo(() => {
    return [...problems].sort((a, b) => {
      return getLikelihoodSortValue(a.likelihood) - getLikelihoodSortValue(b.likelihood);
    });
  }, [problems]);

  if (problems.length === 0) {
    return (
      <div className="bg-slate-800 rounded-lg p-6 text-center">
        <p className="text-slate-400">No avalanche problems reported</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-700/50">
            <tr>
              <th 
                className="px-4 py-3 text-left text-slate-300 font-semibold cursor-pointer hover:text-white"
                onClick={() => handleSort('type')}
              >
                Problem Type {sortBy === 'type' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th 
                className="px-4 py-3 text-left text-slate-300 font-semibold cursor-pointer hover:text-white"
                onClick={() => {
                  setSortBy('likelihood');
                  setSortOrder('asc');
                }}
              >
                Likelihood {sortBy === 'likelihood' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th 
                className="px-4 py-3 text-left text-slate-300 font-semibold cursor-pointer hover:text-white"
                onClick={() => {
                  setSortBy('size');
                  setSortOrder('asc');
                }}
              >
                Size {sortBy === 'size' && (sortOrder === 'asc' ? '↑' : '↓')}
              </th>
              <th className="px-4 py-3 text-left text-slate-300 font-semibold">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700">
            {sortedByLikelihood.map((problem, idx) => (
              <tr key={idx} className="hover:bg-slate-700/30 transition-colors">
                <td className="px-4 py-3">
                  <span className="text-white font-medium">{problem.type}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-amber-400">{problem.likelihood}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-slate-300">{problem.size}</span>
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => setExpandedIdx(expandedIdx === idx ? null : idx)}
                    className="text-blue-400 hover:text-blue-300 text-xs"
                  >
                    {expandedIdx === idx ? 'Hide' : 'Show'} Discussion
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* Expanded Discussion */}
      {expandedIdx !== null && sortedByLikelihood[expandedIdx] && (
        <div className="px-4 py-4 bg-slate-700/30 border-t border-slate-700">
          <h4 className="text-white font-semibold mb-2">
            {sortedByLikelihood[expandedIdx].type} — Discussion
          </h4>
          <div className="mb-3 flex flex-wrap gap-2">
            {sortedByLikelihood[expandedIdx].aspect && sortedByLikelihood[expandedIdx].aspect!.length > 0 && (
              <span className="text-xs bg-slate-600 px-2 py-1 rounded">
                Aspects: {sortedByLikelihood[expandedIdx].aspect!.join(', ')}
              </span>
            )}
            {sortedByLikelihood[expandedIdx].elevation && sortedByLikelihood[expandedIdx].elevation!.length > 0 && (
              <span className="text-xs bg-slate-600 px-2 py-1 rounded">
                Elevation: {sortedByLikelihood[expandedIdx].elevation!.join(', ')}
              </span>
            )}
          </div>
          <p className="text-slate-300 text-sm leading-relaxed">
            {sortedByLikelihood[expandedIdx].discussion || 'No discussion available.'}
          </p>
        </div>
      )}
    </div>
  );
}

// Danger Rose Component (Radar Chart)
function DangerRose({ forecasts }: { forecasts: UnifiedForecast[] }) {
  const radarData = useMemo(() => {
    // Aggregate danger by aspect across all forecasts
    const aspectTotals: Record<string, { total: number; count: number }> = {};
    
    forecasts.forEach(f => {
      Object.entries(f.dangerByAspect).forEach(([aspect, danger]) => {
        if (!aspectTotals[aspect]) {
          aspectTotals[aspect] = { total: 0, count: 0 };
        }
        aspectTotals[aspect].total += danger;
        aspectTotals[aspect].count += 1;
      });
    });

    return Object.entries(aspectTotals)
      .map(([aspect, data]) => ({
        aspect,
        danger: Math.round(data.total / data.count * 10) / 10,
        fullMark: 5,
      }))
      .sort((a, b) => {
        const order = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
        return order.indexOf(a.aspect) - order.indexOf(b.aspect);
      });
  }, [forecasts]);

  const avgDanger = useMemo(() => {
    if (forecasts.length === 0) return 0;
    const sum = forecasts.reduce((acc, f) => acc + f.dangerRating, 0);
    return Math.round(sum / forecasts.length * 10) / 10;
  }, [forecasts]);

  if (radarData.length === 0) {
    return (
      <div className="bg-slate-800 rounded-lg p-6 text-center">
        <p className="text-slate-400">No aspect data available</p>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-semibold">Danger by Aspect</h3>
        <div className="text-slate-400 text-sm">
          Avg: <span className="text-amber-400 font-semibold">{avgDanger}</span>/5
        </div>
      </div>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={radarData}>
            <PolarGrid stroke="#475569" />
            <PolarAngleAxis 
              dataKey="aspect" 
              tick={{ fill: '#94a3b8', fontSize: 12 }}
            />
            <PolarRadiusAxis 
              angle={90} 
              domain={[0, 5]} 
              tick={{ fill: '#64748b', fontSize: 10 }}
            />
            <Radar
              name="Danger"
              dataKey="danger"
              stroke="#f97316"
              fill="#f97316"
              fillOpacity={0.5}
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

  useEffect(() => {
    // Generate 7-day timeline based on available forecasts
    const days = ['Today', 'Tomorrow', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7'];
    const data = days.map((day, idx) => {
      // In a real app, this would come from historical/forecast data
      // For now, we simulate with slight variations
      const baseDanger = forecasts.length > 0 
        ? forecasts.reduce((acc, f) => acc + f.dangerRating, 0) / forecasts.length
        : 2;
      const variation = Math.sin(idx * 0.5) * 0.5;
      return {
        day,
        danger: Math.max(1, Math.min(5, Math.round(baseDanger + variation))),
      };
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

// Dashboard Content Component
function DashboardContent({ forecasts }: { forecasts: UnifiedForecast[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedZone = searchParams.get('zone');
  
  const [showMapOnly, setShowMapOnly] = useState(false);

  // Filter forecasts by selected zone
  const filteredForecasts = useMemo(() => {
    if (!selectedZone) return forecasts;
    return forecasts.filter(f => f.zoneId === selectedZone);
  }, [forecasts, selectedZone]);

  // Get zone list for tabs
  const zoneList = useMemo(() => {
    return ZONE_COORDINATES.map(z => ({
      zoneId: z.zoneId,
      zone: z.zone,
      center: z.center,
    }));
  }, []);

  // Handle zone selection from map or tabs
  const handleZoneSelect = (zoneId: string | null) => {
    if (zoneId) {
      router.push(`/dashboard?zone=${zoneId}`);
    } else {
      router.push('/dashboard');
    }
  };

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
          <button
            onClick={() => setShowMapOnly(false)}
            className="text-blue-400 hover:text-blue-300 text-sm"
          >
            View Combined →
          </button>
        </header>

        {/* Map */}
        <main className="flex-1 relative">
          <div className="absolute inset-0 pt-14">
            <InteractiveMap
              forecasts={forecasts}
              selectedZoneId={selectedZone}
              onZoneSelect={handleZoneSelect}
            />
          </div>
          <ZoneSelectorTabs 
            zones={zoneList}
            selectedZone={selectedZone}
            onSelect={handleZoneSelect}
          />
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
            <span className="text-blue-400 text-sm">
              / {selectedZoneName}
            </span>
          )}
        </div>
        <div className="flex items-center gap-4">
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

      {/* Full-width Map */}
      <div className="relative h-[55vh] min-h-[400px]">
        <InteractiveMap
          forecasts={forecasts}
          selectedZoneId={selectedZone}
          onZoneSelect={handleZoneSelect}
        />
        <ZoneSelectorTabs 
          zones={zoneList}
          selectedZone={selectedZone}
          onSelect={handleZoneSelect}
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
            Data from CAIC (Colorado) and UAC (Utah) • Updated: {new Date().toLocaleTimeString()}
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

// Metadata moved to layout.tsx
