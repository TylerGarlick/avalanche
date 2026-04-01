'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  Legend,
} from 'recharts';
import Link from 'next/link';
import { DANGER_COLORS, DANGER_LABELS, ASPECTS, ELEVATIONS, type UnifiedForecast, type DangerLevel } from '@/lib/types';

interface FilterState {
  zones: string[];
  dangerLevels: DangerLevel[];
  problemTypes: string[];
}

const ASPECT_ANGLES: Record<string, number> = {
  N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315
};

export default function Dashboard() {
  const [forecasts, setForecasts] = useState<UnifiedForecast[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    zones: [],
    dangerLevels: [1, 2, 3, 4, 5],
    problemTypes: [],
  });
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [selectedZone, setSelectedZone] = useState<string>('all');

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch('/api/forecast/all');
        if (response.ok) {
          const data = await response.json();
          setForecasts(data);
        } else {
          throw new Error('Failed to fetch data');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const allZones = useMemo(() => [...new Set(forecasts.map(f => f.zone))], [forecasts]);
  const allProblemTypes = useMemo(
    () => [...new Set(forecasts.flatMap(f => f.avalancheProblems.map(p => p.type)))],
    [forecasts]
  );

  const filteredForecasts = useMemo(() => {
    return forecasts.filter(f => {
      if (filters.zones.length > 0 && !filters.zones.includes(f.zone)) return false;
      if (!filters.dangerLevels.includes(f.dangerRating)) return false;
      if (filters.problemTypes.length > 0) {
        const hasMatchingProblem = f.avalancheProblems.some(p => filters.problemTypes.includes(p.type));
        if (!hasMatchingProblem) return false;
      }
      return true;
    });
  }, [forecasts, filters]);

  // Cross-center alert detection
  const crossCenterAlert = useMemo(() => {
    const caicHigh = forecasts.filter(f => f.center === 'CAIC' && f.dangerRating >= 4);
    const uacHigh = forecasts.filter(f => f.center === 'UAC' && f.dangerRating >= 4);
    
    if (caicHigh.length > 0 && uacHigh.length > 0) {
      const caicProblems = new Set(caicHigh.flatMap(f => f.avalancheProblems.map(p => p.type)));
      const uacProblems = new Set(uacHigh.flatMap(f => f.avalancheProblems.map(p => p.type)));
      const commonProblems = [...caicProblems].filter(p => uacProblems.has(p));
      
      if (commonProblems.length > 0) {
        return `Cross-center pattern detected: ${commonProblems.join(', ')} activity across Colorado and Utah`;
      }
    }
    return null;
  }, [forecasts]);

  const toggleZone = (zone: string) => {
    setFilters(prev => ({
      ...prev,
      zones: prev.zones.includes(zone)
        ? prev.zones.filter(z => z !== zone)
        : [...prev.zones, zone],
    }));
  };

  const toggleDangerLevel = (level: DangerLevel) => {
    setFilters(prev => ({
      ...prev,
      dangerLevels: prev.dangerLevels.includes(level)
        ? prev.dangerLevels.filter(l => l !== level)
        : [...prev.dangerLevels, level],
    }));
  };

  const toggleProblemType = (type: string) => {
    setFilters(prev => ({
      ...prev,
      problemTypes: prev.problemTypes.includes(type)
        ? prev.problemTypes.filter(t => t !== type)
        : [...prev.problemTypes, type],
    }));
  };

  const toggleRowExpansion = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Heat map data preparation
  const heatMapData = useMemo(() => {
    const data: Array<{ elevation: string; [key: string]: string | number }> = [];
    const targetZones = selectedZone === 'all' 
      ? (filters.zones.length > 0 ? filters.zones : allZones.slice(0, 1))
      : [selectedZone];

    for (const elevation of ELEVATIONS) {
      const row: { elevation: string; [key: string]: string | number } = { elevation };
      for (const aspect of ASPECTS) {
        const dangers = targetZones.flatMap(zone => {
          const forecast = forecasts.find(f => f.zone === zone);
          return forecast ? [forecast.dangerByAspect[aspect] || forecast.dangerRating] : [];
        });
        row[aspect] = dangers.length > 0 ? Math.round(dangers.reduce((a, b) => a + b, 0) / dangers.length) : 0;
      }
      data.push(row);
    }
    return data;
  }, [forecasts, selectedZone, filters.zones, allZones]);

  // Danger rose data
  const dangerRoseData = useMemo(() => {
    const data = ASPECTS.map(aspect => {
      const entry: Record<string, string | number> = { aspect };
      for (const forecast of filteredForecasts.slice(0, 5)) {
        const danger = forecast.dangerByAspect[aspect] || forecast.dangerRating;
        entry[forecast.zone] = danger;
      }
      return entry;
    });
    return data;
  }, [filteredForecasts]);

  // Timeline data (7-day mock)
  const timelineData = useMemo(() => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    return days.map((day, i) => {
      const entry: Record<string, string | number> = { day };
      for (const zone of (filters.zones.length > 0 ? filters.zones : allZones).slice(0, 5)) {
        // Mock historical data with some variation
        const base = forecasts.find(f => f.zone === zone)?.dangerRating || 2;
        entry[zone] = Math.max(1, Math.min(5, base + Math.sin(i * 0.8) + (Math.random() - 0.5)));
      }
      return entry;
    });
  }, [forecasts, filters.zones, allZones]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading avalanche data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-red-400 text-xl">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Avalanche Forecast Dashboard</h1>
            <p className="text-slate-400 text-sm mt-1">
              Colorado & Utah Avalanche Information
            </p>
          </div>
          <Link
            href="/map"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
          >
            🗺️ View Map
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Cross-Center Alert */}
        {crossCenterAlert && (
          <div className="bg-red-900/50 border border-red-500 rounded-lg p-4 flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <p className="text-red-200">{crossCenterAlert}</p>
          </div>
        )}

        {/* Filter Bar */}
        <div className="bg-slate-800 rounded-lg p-4 space-y-4">
          <div className="flex flex-wrap gap-4 items-center">
            {/* Zone Multi-Select */}
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm text-slate-400 mb-2">Zones</label>
              <div className="flex flex-wrap gap-2">
                {allZones.map(zone => (
                  <button
                    key={zone}
                    onClick={() => toggleZone(zone)}
                    className={`px-3 py-1 rounded text-sm transition-colors ${
                      filters.zones.includes(zone)
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    {zone}
                  </button>
                ))}
              </div>
            </div>

            {/* Danger Level Filter */}
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm text-slate-400 mb-2">Danger Level</label>
              <div className="flex flex-wrap gap-2">
                {([1, 2, 3, 4, 5] as DangerLevel[]).map(level => (
                  <button
                    key={level}
                    onClick={() => toggleDangerLevel(level)}
                    className={`px-3 py-1 rounded text-sm transition-colors ${
                      filters.dangerLevels.includes(level)
                        ? 'text-white'
                        : 'bg-slate-700 text-slate-500 hover:bg-slate-600'
                    }`}
                    style={{
                      backgroundColor: filters.dangerLevels.includes(level) 
                        ? DANGER_COLORS[level] 
                        : undefined,
                    }}
                  >
                    {DANGER_LABELS[level]}
                  </button>
                ))}
              </div>
            </div>

            {/* Problem Type Filter */}
            <div className="flex-1 min-w-[200px]">
              <label className="block text-sm text-slate-400 mb-2">Problem Types</label>
              <div className="flex flex-wrap gap-2">
                {allProblemTypes.map(type => (
                  <button
                    key={type}
                    onClick={() => toggleProblemType(type)}
                    className={`px-3 py-1 rounded text-sm transition-colors ${
                      filters.problemTypes.includes(type)
                        ? 'bg-purple-600 text-white'
                        : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Danger Heat Map */}
          <div className="bg-slate-800 rounded-lg p-4">
            <h2 className="text-lg font-semibold mb-4">Danger by Aspect & Elevation</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="text-left text-slate-400 p-2">Elevation</th>
                    {ASPECTS.map(aspect => (
                      <th key={aspect} className="text-center text-slate-400 p-2 w-12">
                        {aspect}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {heatMapData.map(row => (
                    <tr key={row.elevation}>
                      <td className="text-slate-400 p-2">{row.elevation}</td>
                      {ASPECTS.map(aspect => {
                        const danger = row[aspect] as number;
                        return (
                          <td
                            key={aspect}
                            className="text-center p-1"
                          >
                            <div
                              className="rounded w-10 h-10 mx-auto flex items-center justify-center text-white font-bold text-sm"
                              style={{
                                backgroundColor: danger > 0 
                                  ? DANGER_COLORS[danger as DangerLevel] 
                                  : '#374151',
                              }}
                              title={`${aspect} @ ${row.elevation}: ${danger > 0 ? DANGER_LABELS[danger as DangerLevel] : 'N/A'}`}
                            >
                              {danger || '-'}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex justify-center gap-2">
              {([1, 2, 3, 4, 5] as DangerLevel[]).map(level => (
                <div key={level} className="flex items-center gap-1">
                  <div
                    className="w-4 h-4 rounded"
                    style={{ backgroundColor: DANGER_COLORS[level] }}
                  />
                  <span className="text-xs text-slate-400">{DANGER_LABELS[level]}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Danger Rose */}
          <div className="bg-slate-800 rounded-lg p-4">
            <h2 className="text-lg font-semibold mb-4">Danger Rose</h2>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={dangerRoseData} cx="50%" cy="50%" outerRadius="70%">
                  <PolarGrid stroke="#475569" />
                  <PolarAngleAxis 
                    dataKey="aspect" 
                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                  />
                  <PolarRadiusAxis 
                    angle={90} 
                    domain={[0, 5]} 
                    tick={{ fill: '#94a3b8', fontSize: 10 }}
                    tickCount={5}
                  />
                  {filteredForecasts.slice(0, 5).map((forecast, i) => (
                    <Radar
                      key={forecast.zoneId}
                      name={forecast.zone}
                      dataKey={forecast.zone}
                      stroke={['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'][i]}
                      fill={['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'][i]}
                      fillOpacity={0.2}
                    />
                  ))}
                  <Legend />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: 'none' }}
                    labelStyle={{ color: '#fff' }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Timeline View */}
          <div className="bg-slate-800 rounded-lg p-4">
            <h2 className="text-lg font-semibold mb-4">7-Day Danger Trend</h2>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timelineData}>
                  <defs>
                    {filteredForecasts.slice(0, 5).map((forecast, i) => (
                      <linearGradient key={forecast.zoneId} id={`gradient-${i}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'][i]} stopOpacity={0.4} />
                        <stop offset="95%" stopColor={['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'][i]} stopOpacity={0} />
                      </linearGradient>
                    ))}
                  </defs>
                  <XAxis dataKey="day" stroke="#64748b" />
                  <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} stroke="#64748b" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: 'none' }}
                    labelStyle={{ color: '#fff' }}
                  />
                  {filteredForecasts.slice(0, 5).map((forecast, i) => (
                    <Area
                      key={forecast.zoneId}
                      type="monotone"
                      dataKey={forecast.zone}
                      stroke={['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'][i]}
                      fill={`url(#gradient-${i})`}
                      strokeWidth={2}
                    />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Summary Stats */}
          <div className="bg-slate-800 rounded-lg p-4">
            <h2 className="text-lg font-semibold mb-4">Forecast Summary</h2>
            <div className="grid grid-cols-2 gap-4">
              {([1, 2, 3, 4, 5] as DangerLevel[]).map(level => {
                const count = filteredForecasts.filter(f => f.dangerRating === level).length;
                return (
                  <div
                    key={level}
                    className="p-4 rounded-lg"
                    style={{ backgroundColor: `${DANGER_COLORS[level]}20` }}
                  >
                    <div className="text-3xl font-bold" style={{ color: DANGER_COLORS[level] }}>
                      {count}
                    </div>
                    <div className="text-slate-400 text-sm">{DANGER_LABELS[level]}</div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 text-sm text-slate-400">
              <div>Total Zones: {filteredForecasts.length}</div>
              <div>CAIC Zones: {filteredForecasts.filter(f => f.center === 'CAIC').length}</div>
              <div>UAC Zones: {filteredForecasts.filter(f => f.center === 'UAC').length}</div>
            </div>
          </div>
        </div>

        {/* Avalanche Problems Table */}
        <div className="bg-slate-800 rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-4">Active Avalanche Problems</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-700">
                  <th className="p-3">Zone</th>
                  <th className="p-3">Center</th>
                  <th className="p-3">Problem Type</th>
                  <th className="p-3">Likelihood</th>
                  <th className="p-3">Size</th>
                  <th className="p-3">Danger</th>
                </tr>
              </thead>
              <tbody>
                {filteredForecasts.flatMap(forecast =>
                  forecast.avalancheProblems.map((problem, idx) => (
                    <tr
                      key={`${forecast.zoneId}-${idx}`}
                      className="border-b border-slate-700/50 hover:bg-slate-700/30"
                    >
                      <td className="p-3">
                        <button
                          onClick={() => toggleRowExpansion(`${forecast.zoneId}-${idx}`)}
                          className="text-left hover:text-blue-400"
                        >
                          {forecast.zone}
                          {forecast.avalancheProblems.length > 1 && (
                            <span className="text-slate-500 text-xs ml-1">({idx + 1})</span>
                          )}
                        </button>
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-xs ${
                          forecast.center === 'CAIC' ? 'bg-blue-900 text-blue-300' : 'bg-green-900 text-green-300'
                        }`}>
                          {forecast.center}
                        </span>
                      </td>
                      <td className="p-3">{problem.type}</td>
                      <td className="p-3">{problem.likelihood}</td>
                      <td className="p-3">{problem.size}</td>
                      <td className="p-3">
                        <span
                          className="px-2 py-0.5 rounded text-xs text-white font-medium"
                          style={{ backgroundColor: DANGER_COLORS[forecast.dangerRating] }}
                        >
                          {DANGER_LABELS[forecast.dangerRating]}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-slate-800 border-t border-slate-700 px-6 py-4 mt-8">
        <div className="max-w-7xl mx-auto text-sm text-slate-400">
          <p>Data sourced from Colorado Avalanche Information Center (CAIC) and Utah Avalanche Center (UAC)</p>
          <p className="mt-1">Last updated: {new Date().toLocaleString()}</p>
        </div>
      </footer>
    </div>
  );
}
