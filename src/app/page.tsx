'use client';

import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { DANGER_COLORS, DANGER_LABELS, type UnifiedForecast, type DangerLevel } from '@/lib/types';

// Dynamically import Leaflet to avoid SSR issues
const InteractiveMap = dynamic(
  () => import('@/components/InteractiveMap').then(mod => mod.default),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full bg-slate-800 flex items-center justify-center">
        <div className="text-slate-400 text-xl">Loading map...</div>
      </div>
    )
  }
);

// Aspect × Elevation Heat Map
function HeatMap({ forecast }: { forecast: UnifiedForecast }) {
  const aspects = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const elevations = ['Below Treeline', 'Treeline', 'Above Treeline'];

  const getDanger = (aspect: string, elevation: string) => {
    const elevationKey = elevation.replace(' ', '') as keyof typeof forecast.dangerByElevation;
    const byElev = forecast.dangerByElevation[elevationKey] ?? forecast.dangerRating;
    return byElev;
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr>
            <th className="p-1 text-slate-500 font-normal text-left"></th>
            {aspects.map(a => (
              <th key={a} className="p-1 text-slate-500 font-normal text-center">{a}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {elevations.map(elev => (
            <tr key={elev}>
              <td className="p-1 text-slate-400 text-xs whitespace-nowrap">{elev}</td>
              {aspects.map(asp => {
                const danger = getDanger(asp, elev);
                return (
                  <td key={asp} className="p-0.5">
                    <div
                      className="w-7 h-7 rounded flex items-center justify-center text-white font-medium"
                      style={{ backgroundColor: DANGER_COLORS[danger as DangerLevel] }}
                      title={`${elev} / ${asp}: ${DANGER_LABELS[danger as DangerLevel]}`}
                    >
                      {danger}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Zone Details Slide-In Panel
function ZoneDetailsPanel({
  forecasts,
  selectedZone,
  onClose,
}: {
  forecasts: UnifiedForecast[];
  selectedZone: string | null;
  onClose: () => void;
}) {
  const [expandedProblem, setExpandedProblem] = useState<number | null>(null);

  const forecast = useMemo(() => {
    return forecasts.find(f => f.zoneId === selectedZone);
  }, [forecasts, selectedZone]);

  if (!selectedZone || !forecast) return null;

  return (
    <div className="absolute inset-y-0 right-0 w-full md:w-96 bg-slate-900/98 backdrop-blur-sm border-l border-slate-700 shadow-2xl z-[1000] overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 bg-slate-900/98 backdrop-blur-sm border-b border-slate-700 p-4 flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: DANGER_COLORS[forecast.dangerRating as DangerLevel] }}
            />
            <h2 className="text-white font-bold text-lg">{forecast.zone}</h2>
          </div>
          <span
            className="text-xs text-white px-2 py-0.5 rounded"
            style={{ backgroundColor: DANGER_COLORS[forecast.dangerRating as DangerLevel] }}
          >
            {DANGER_LABELS[forecast.dangerRating as DangerLevel]}
          </span>
          <p className="text-slate-400 text-xs mt-1">{forecast.center} • Zone {forecast.zoneId}</p>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white p-1 ml-2"
          aria-label="Close panel"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="p-4 space-y-6">
        {/* Danger by Elevation */}
        <div>
          <h3 className="text-slate-300 text-sm font-semibold mb-2">Danger by Elevation</h3>
          <div className="space-y-1">
            {(['Above Treeline', 'Treeline', 'Below Treeline'] as const).map(elev => {
              const key = elev.replace(' ', '') as keyof typeof forecast.dangerByElevation;
              const danger = forecast.dangerByElevation[key] ?? forecast.dangerRating;
              return (
                <div key={elev} className="flex items-center justify-between">
                  <span className="text-slate-400 text-xs">{elev}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-2 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(danger / 5) * 100}%`,
                          backgroundColor: DANGER_COLORS[danger as DangerLevel],
                        }}
                      />
                    </div>
                    <span
                      className="text-xs text-white font-medium w-16 text-right"
                      style={{ color: DANGER_COLORS[danger as DangerLevel] }}
                    >
                      {DANGER_LABELS[danger as DangerLevel]}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Heat Map */}
        <div>
          <h3 className="text-slate-300 text-sm font-semibold mb-2">Aspect × Elevation</h3>
          <HeatMap forecast={forecast} />
        </div>

        {/* Avalanche Problems */}
        <div>
          <h3 className="text-slate-300 text-sm font-semibold mb-3">
            Avalanche Problems ({forecast.avalancheProblems.length})
          </h3>
          {forecast.avalancheProblems.length === 0 ? (
            <p className="text-slate-500 text-sm">No avalanche problems forecasted.</p>
          ) : (
            <div className="space-y-2">
              {forecast.avalancheProblems.map((problem, idx) => (
                <div
                  key={idx}
                  className="bg-slate-800 rounded-lg overflow-hidden border border-slate-700"
                >
                  <button
                    onClick={() => setExpandedProblem(expandedProblem === idx ? null : idx)}
                    className="w-full p-3 flex items-center justify-between text-left hover:bg-slate-700/50 transition-colors"
                  >
                    <div>
                      <div className="text-white text-sm font-medium">{problem.type}</div>
                      <div className="flex gap-2 mt-0.5">
                        <span className="text-xs text-slate-400">{problem.likelihood}</span>
                        <span className="text-xs text-slate-500">•</span>
                        <span className="text-xs text-slate-400">{problem.size}</span>
                      </div>
                    </div>
                    <svg
                      className={`w-4 h-4 text-slate-400 transition-transform ${expandedProblem === idx ? 'rotate-180' : ''}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {expandedProblem === idx && (
                    <div className="px-3 pb-3 border-t border-slate-700/50 pt-2">
                      {problem.aspect && problem.aspect.length > 0 && (
                        <div className="mb-2">
                          <span className="text-xs text-slate-500"> Aspects: </span>
                          <span className="text-xs text-slate-300">
                            {problem.aspect.join(', ')}
                          </span>
                        </div>
                      )}
                      {problem.elevation && (
                        <div className="mb-2">
                          <span className="text-xs text-slate-500"> Elevation: </span>
                          <span className="text-xs text-slate-300">{problem.elevation}</span>
                        </div>
                      )}
                      {problem.discussion && (
                        <p className="text-xs text-slate-400 leading-relaxed mt-2">
                          {problem.discussion}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Discussion */}
        {forecast.forecastDiscussion && (
          <div>
            <h3 className="text-slate-300 text-sm font-semibold mb-2">Discussion</h3>
            <p className="text-slate-400 text-xs leading-relaxed">{forecast.forecastDiscussion}</p>
          </div>
        )}

        {/* Day Rating */}
        <div>
          <h3 className="text-slate-300 text-sm font-semibold mb-2">Today&apos;s Rating</h3>
          <div className="flex items-center gap-3">
            <span
              className="text-2xl font-bold"
              style={{ color: DANGER_COLORS[forecast.dangerRating as DangerLevel] }}
            >
              {forecast.dangerRating}
            </span>
            <span
              className="text-sm"
              style={{ color: DANGER_COLORS[forecast.dangerRating as DangerLevel] }}
            >
              {DANGER_LABELS[forecast.dangerRating as DangerLevel]}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Main Page Component
export default function MapPageClient() {
  const [forecasts, setForecasts] = useState<UnifiedForecast[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const searchParams = useSearchParams();

  // Fetch forecast data
  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch('/api/forecast/all');
        if (!res.ok) throw new Error('Failed to load forecast data');
        const data = await res.json();
        setForecasts(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // Sync selected zone from URL
  useEffect(() => {
    const zone = searchParams.get('zone');
    setSelectedZone(zone);
  }, [searchParams]);

  const handleZoneSelect = (zoneId: string) => {
    setSelectedZone(zoneId);
  };

  const handleClosePanel = () => {
    setSelectedZone(null);
  };

  return (
    <div className="h-screen w-full flex flex-col bg-slate-900">
      {/* Header */}
      <header className="bg-slate-800 border-b border-slate-700 px-4 py-3 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <h1 className="text-white text-xl font-bold">Avalanche Forecast</h1>
          {!loading && (
            <span className="text-slate-400 text-sm">
              {forecasts.length} zones
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <a
            href="/dashboard"
            className="text-slate-400 hover:text-white text-sm transition-colors"
          >
            Dashboard →
          </a>
          <a
            href="/no-go"
            className="text-slate-400 hover:text-white text-sm transition-colors"
          >
            No-Go →
          </a>
        </div>
      </header>

      {/* Map + Details Panel */}
      <div className="flex-1 relative overflow-hidden">
        {loading ? (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-slate-400 text-xl">Loading forecasts...</div>
          </div>
        ) : error ? (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-red-400 text-xl">Error: {error}</div>
          </div>
        ) : (
          <>
            {/* Map */}
            <div className="absolute inset-0">
              <InteractiveMap
                forecasts={forecasts}
                selectedZoneId={selectedZone}
                onZoneSelect={handleZoneSelect}
              />
            </div>

            {/* Zone Details Panel */}
            <ZoneDetailsPanel
              forecasts={forecasts}
              selectedZone={selectedZone}
              onClose={handleClosePanel}
            />
          </>
        )}
      </div>
    </div>
  );
}
