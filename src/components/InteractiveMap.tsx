'use client';

import { useState, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { ZONE_COORDINATES, MAP_BOUNDS } from '@/lib/zone-coordinates';
import { DANGER_COLORS, DANGER_LABELS, type UnifiedForecast, type DangerLevel } from '@/lib/types';
import Link from 'next/link';

// Dynamically import Leaflet components with SSR disabled
const MapContainer = dynamic(
  () => import('react-leaflet').then(mod => mod.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import('react-leaflet').then(mod => mod.TileLayer),
  { ssr: false }
);
const Marker = dynamic(
  () => import('react-leaflet').then(mod => mod.Marker),
  { ssr: false }
);
const Popup = dynamic(
  () => import('react-leaflet').then(mod => mod.Popup),
  { ssr: false }
);
const CircleMarker = dynamic(
  () => import('react-leaflet').then(mod => mod.CircleMarker),
  { ssr: false }
);

// Placeholder component during SSR
function MapPlaceholder() {
  return (
    <div className="w-full h-full bg-slate-800 flex items-center justify-center">
      <div className="text-slate-400 text-center">
        <div className="animate-pulse text-xl mb-2">🗺️</div>
        <div>Loading map...</div>
      </div>
    </div>
  );
}

interface InteractiveMapProps {
  forecasts: UnifiedForecast[];
  selectedZoneId?: string | null;
  onZoneSelect?: (zoneId: string | null) => void;
}

export default function InteractiveMap({ forecasts, selectedZoneId, onZoneSelect }: InteractiveMapProps) {
  const [leafletReady, setLeafletReady] = useState(false);
  const [selectedForecast, setSelectedForecast] = useState<UnifiedForecast | null>(null);

  // Merge forecasts with coordinates
  const zoneData = useMemo(() => {
    return ZONE_COORDINATES.map(coord => {
      const forecast = forecasts.find(f => f.zoneId === coord.zoneId || f.zone === coord.zone);
      return {
        ...coord,
        forecast,
        dangerRating: forecast?.dangerRating || 1,
      };
    });
  }, [forecasts]);

  // Group zones by center
  const caicZones = zoneData.filter(z => z.center === 'CAIC');
  const uacZones = zoneData.filter(z => z.center === 'UAC');

  // Count by danger level
  const dangerCounts = useMemo(() => {
    const counts: Record<DangerLevel, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    forecasts.forEach(f => {
      counts[f.dangerRating]++;
    });
    return counts;
  }, [forecasts]);

  const handleZoneClick = (zone: typeof zoneData[0]) => {
    if (zone.forecast) {
      setSelectedForecast(zone.forecast);
      onZoneSelect?.(zone.zoneId);
    }
  };

  const getMarkerColor = (danger: DangerLevel) => DANGER_COLORS[danger];

  if (!leafletReady) {
    // Import leaflet CSS on client side
    if (typeof window !== 'undefined') {
      import('leaflet').then(L => {
        // Fix default marker icon
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
          iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
          shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
        });
        setLeafletReady(true);
      });
    }
  }

  return (
    <div className="flex flex-col lg:flex-row h-full">
      {/* Map Container */}
      <div className="flex-1 relative">
        {typeof window === 'undefined' ? (
          <MapPlaceholder />
        ) : (
          <>
            <link
              rel="stylesheet"
              href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"
              crossOrigin=""
            />
            <MapContainer
              center={MAP_BOUNDS.center}
              zoom={MAP_BOUNDS.zoom}
              className="w-full h-full min-h-[400px]"
              scrollWheelZoom={true}
              zoomControl={true}
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              
              {/* CAIC Zones */}
              {zoneData.map(zone => (
                <CircleMarker
                  key={zone.zoneId}
                  center={[zone.lat, zone.lng]}
                  radius={selectedZoneId === zone.zoneId ? 16 : 12}
                  pathOptions={{
                    color: getMarkerColor(zone.dangerRating as DangerLevel),
                    fillColor: getMarkerColor(zone.dangerRating as DangerLevel),
                    fillOpacity: 0.8,
                    weight: selectedZoneId === zone.zoneId ? 3 : 2,
                  }}
                  eventHandlers={{
                    click: () => handleZoneClick(zone),
                  }}
                >
                  <Popup className="avalanche-popup">
                    <div className="min-w-[200px]">
                      <h3 className="font-bold text-base mb-1">{zone.zone}</h3>
                      <span className={`inline-block px-2 py-0.5 rounded text-xs text-white font-medium mb-2`}
                        style={{ backgroundColor: getMarkerColor(zone.dangerRating as DangerLevel) }}>
                        {DANGER_LABELS[zone.dangerRating as DangerLevel]}
                      </span>
                      {zone.forecast ? (
                        <p className="text-sm text-gray-600">
                          {zone.forecast.avalancheProblems.length} avalanche problem{zone.forecast.avalancheProblems.length !== 1 ? 's' : ''}
                        </p>
                      ) : (
                        <p className="text-sm text-gray-500">No forecast available</p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">Click for details</p>
                    </div>
                  </Popup>
                </CircleMarker>
              ))}
            </MapContainer>
          </>
        )}

        {/* Map Legend Overlay */}
        <div className="absolute bottom-4 left-4 bg-slate-900/95 rounded-lg p-3 z-[1000] shadow-lg">
          <h4 className="text-white text-sm font-semibold mb-2">Danger Level</h4>
          <div className="space-y-1">
            {([5, 4, 3, 2, 1] as DangerLevel[]).map(level => (
              <div key={level} className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded-full"
                  style={{ backgroundColor: DANGER_COLORS[level] }}
                />
                <span className="text-white text-xs">{DANGER_LABELS[level]}</span>
                <span className="text-slate-400 text-xs">({dangerCounts[level]})</span>
              </div>
            ))}
          </div>
        </div>

        {/* Zone Count Overlay */}
        <div className="absolute top-4 left-4 bg-slate-900/95 rounded-lg p-3 z-[1000] shadow-lg">
          <div className="text-white text-sm font-semibold">
            {forecasts.length} Zones
          </div>
          <div className="flex gap-3 mt-1">
            <span className="text-blue-400 text-xs">CAIC: {caicZones.length}</span>
            <span className="text-green-400 text-xs">UAC: {uacZones.length}</span>
          </div>
        </div>
      </div>

      {/* Sidebar with Forecast Details */}
      <div className="w-full lg:w-96 bg-slate-800 border-l border-slate-700 overflow-y-auto">
        {selectedForecast ? (
          <ForecastSidebar forecast={selectedForecast} onClose={() => {
            setSelectedForecast(null);
            onZoneSelect?.(null);
          }} />
        ) : (
          <div className="p-4">
            <h2 className="text-white text-lg font-semibold mb-4">Select a Zone</h2>
            <p className="text-slate-400 text-sm mb-4">
              Click on a marker on the map to view forecast details, or browse zones below.
            </p>
            
            {/* CAIC Zones */}
            <div className="mb-6">
              <h3 className="text-blue-400 text-sm font-semibold mb-2 uppercase tracking-wide">
                Colorado (CAIC)
              </h3>
              <div className="space-y-2">
                {caicZones.map(zone => (
                  <button
                    key={zone.zoneId}
                    onClick={() => handleZoneClick(zone)}
                    className="w-full text-left p-3 rounded-lg bg-slate-700/50 hover:bg-slate-700 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-white text-sm">{zone.zone}</span>
                      <span
                        className="px-2 py-0.5 rounded text-xs text-white font-medium"
                        style={{ backgroundColor: getMarkerColor(zone.dangerRating as DangerLevel) }}
                      >
                        {DANGER_LABELS[zone.dangerRating as DangerLevel]}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* UAC Zones */}
            <div>
              <h3 className="text-green-400 text-sm font-semibold mb-2 uppercase tracking-wide">
                Utah (UAC)
              </h3>
              <div className="space-y-2">
                {uacZones.map(zone => (
                  <button
                    key={zone.zoneId}
                    onClick={() => handleZoneClick(zone)}
                    className="w-full text-left p-3 rounded-lg bg-slate-700/50 hover:bg-slate-700 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-white text-sm">{zone.zone}</span>
                      <span
                        className="px-2 py-0.5 rounded text-xs text-white font-medium"
                        style={{ backgroundColor: getMarkerColor(zone.dangerRating as DangerLevel) }}
                      >
                        {DANGER_LABELS[zone.dangerRating as DangerLevel]}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Forecast Details Sidebar Component
function ForecastSidebar({ forecast, onClose }: { forecast: UnifiedForecast; onClose: () => void }) {
  return (
    <div className="p-4">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <span className={`inline-block px-2 py-0.5 rounded text-xs text-white font-medium mb-2 ${
            forecast.center === 'CAIC' ? 'bg-blue-600' : 'bg-green-600'
          }`}>
            {forecast.center}
          </span>
          <h2 className="text-white text-xl font-semibold">{forecast.zone}</h2>
          <p className="text-slate-400 text-sm">{forecast.validDay}</p>
        </div>
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-white p-1"
        >
          ✕
        </button>
      </div>

      {/* Danger Rating */}
      <div className="mb-6">
        <div className="flex items-center gap-3 p-4 rounded-lg" style={{
          backgroundColor: `${DANGER_COLORS[forecast.dangerRating]}20`
        }}>
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center text-white text-2xl font-bold"
            style={{ backgroundColor: DANGER_COLORS[forecast.dangerRating] }}
          >
            {forecast.dangerRating}
          </div>
          <div>
            <div className="text-white font-semibold text-lg">
              {DANGER_LABELS[forecast.dangerRating]}
            </div>
            <div className="text-slate-400 text-sm">Danger Rating</div>
          </div>
        </div>
      </div>

      {/* Danger by Aspect */}
      {Object.keys(forecast.dangerByAspect).length > 0 && (
        <div className="mb-6">
          <h3 className="text-white text-sm font-semibold mb-2">Danger by Aspect</h3>
          <div className="grid grid-cols-4 gap-2">
            {Object.entries(forecast.dangerByAspect).map(([aspect, danger]) => (
              <div key={aspect} className="text-center">
                <div
                  className="w-full aspect-square rounded flex items-center justify-center text-white text-sm font-bold"
                  style={{ backgroundColor: DANGER_COLORS[danger as DangerLevel] }}
                >
                  {danger}
                </div>
                <div className="text-slate-400 text-xs mt-1">{aspect}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Danger by Elevation */}
      {Object.keys(forecast.dangerByElevation).length > 0 && (
        <div className="mb-6">
          <h3 className="text-white text-sm font-semibold mb-2">Danger by Elevation</h3>
          <div className="space-y-2">
            {Object.entries(forecast.dangerByElevation).map(([elevation, danger]) => (
              <div key={elevation} className="flex items-center gap-2">
                <span className="text-slate-400 text-sm w-28">{elevation}</span>
                <div className="flex-1 h-6 rounded" style={{
                  backgroundColor: `${DANGER_COLORS[danger as DangerLevel]}40`
                }}>
                  <div
                    className="h-full rounded flex items-center justify-center text-white text-xs font-medium"
                    style={{
                      width: `${(danger / 5) * 100}%`,
                      backgroundColor: DANGER_COLORS[danger as DangerLevel]
                    }}
                  >
                    {DANGER_LABELS[danger as DangerLevel]}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Avalanche Problems */}
      {forecast.avalancheProblems.length > 0 && (
        <div className="mb-6">
          <h3 className="text-white text-sm font-semibold mb-3">
            Avalanche Problems ({forecast.avalancheProblems.length})
          </h3>
          <div className="space-y-3">
            {forecast.avalancheProblems.map((problem, idx) => (
              <div key={idx} className="bg-slate-700/50 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-white font-medium">{problem.type}</span>
                  <span className="text-slate-400 text-xs">{problem.likelihood}</span>
                </div>
                <div className="text-slate-400 text-xs mb-2">
                  Size: {problem.size}
                  {problem.aspect && problem.aspect.length > 0 && (
                    <> • Aspects: {problem.aspect.join(', ')}</>
                  )}
                  {problem.elevation && problem.elevation.length > 0 && (
                    <> • {problem.elevation.join(', ')}</>
                  )}
                </div>
                {problem.discussion && (
                  <p className="text-slate-300 text-xs mt-2 line-clamp-3">
                    {problem.discussion}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Forecast Discussion */}
      {forecast.forecastDiscussion && (
        <div className="mb-6">
          <h3 className="text-white text-sm font-semibold mb-2">Forecast Discussion</h3>
          <p className="text-slate-300 text-sm leading-relaxed">
            {forecast.forecastDiscussion}
          </p>
        </div>
      )}

      {/* Footer */}
      <div className="text-slate-500 text-xs border-t border-slate-700 pt-4">
        Published: {new Date(forecast.publishedAt).toLocaleString()}
      </div>
    </div>
  );
}
