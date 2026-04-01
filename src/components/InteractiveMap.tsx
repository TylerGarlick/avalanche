'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import type { Map as LMap } from 'leaflet';
import { ZONE_COORDINATES, MAP_BOUNDS } from '@/lib/zone-coordinates';
import { DANGER_COLORS, DANGER_LABELS, type UnifiedForecast, type DangerLevel } from '@/lib/types';

// Dynamically import Leaflet CSS
// MapContainer is used directly (not dynamic) since it's a React component
// Individual Leaflet components come from react-leaflet directly

// Placeholder during SSR
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
  onZoomChange?: (zoom: number) => void;
}

// Inner component — inside MapContainer so useMap works
function MapInner({
  forecasts,
  selectedZoneId,
  onZoneSelect,
  onZoomChange,
}: InteractiveMapProps) {
  const map = useMap();
  const onZoomChangeRef = useRef(onZoomChange);
  onZoomChangeRef.current = onZoomChange;

  // Handle zoom events
  useEffect(() => {
    if (!map) return;
    const handler = () => {
      onZoomChangeRef.current?.(map.getZoom());
    };
    map.on('zoomend', handler);
    return () => { map.off('zoomend', handler); };
  }, [map]);

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

  const dangerCounts = useMemo(() => {
    const counts: Record<DangerLevel, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    forecasts.forEach(f => { counts[f.dangerRating]++; });
    return counts;
  }, [forecasts]);

  const getMarkerColor = (danger: DangerLevel) => DANGER_COLORS[danger];

  const handleZoneClick = (zoneId: string) => {
    onZoneSelect?.(zoneId);
  };

  return (
    <>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

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
          eventHandlers={{ click: () => handleZoneClick(zone.zoneId) }}
        >
          <Popup className="avalanche-popup">
            <div className="min-w-[200px]">
              <h3 className="font-bold text-base mb-1">{zone.zone}</h3>
              <span
                className="inline-block px-2 py-0.5 rounded text-xs text-white font-medium mb-2"
                style={{ backgroundColor: getMarkerColor(zone.dangerRating as DangerLevel) }}
              >
                {DANGER_LABELS[zone.dangerRating as DangerLevel]}
              </span>
              {zone.forecast ? (
                <p className="text-sm text-gray-600">
                  {zone.forecast.avalancheProblems.length} avalanche problem
                  {zone.forecast.avalancheProblems.length !== 1 ? 's' : ''}
                </p>
              ) : (
                <p className="text-sm text-gray-500">No forecast available</p>
              )}
              <p className="text-xs text-gray-400 mt-1">Click for details</p>
            </div>
          </Popup>
        </CircleMarker>
      ))}

      {/* Legend */}
      <div className="leaflet-bottom leaflet-left" style={{ bottom: '20px', left: '10px', zIndex: 1000 }}>
        <div className="bg-slate-900/95 rounded-lg p-3 shadow-lg">
          <h4 className="text-white text-sm font-semibold mb-2">Danger Level</h4>
          <div className="space-y-1">
            {([5, 4, 3, 2, 1] as DangerLevel[]).map(level => (
              <div key={level} className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-full" style={{ backgroundColor: DANGER_COLORS[level] }} />
                <span className="text-white text-xs">{DANGER_LABELS[level]}</span>
                <span className="text-slate-400 text-xs">({dangerCounts[level]})</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

export default function InteractiveMap(props: InteractiveMapProps) {
  const [leafletReady, setLeafletReady] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && !leafletReady) {
      import('leaflet').then(L => {
        // Fix default marker icons
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
  }, [leafletReady]);

  if (typeof window === 'undefined' || !leafletReady) {
    return <MapPlaceholder />;
  }

  return (
    <>
      <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"
        crossOrigin=""
      />
      <MapContainer
        center={MAP_BOUNDS.center as [number, number]}
        zoom={MAP_BOUNDS.zoom}
        className="w-full h-full min-h-[400px]"
        scrollWheelZoom={true}
        zoomControl={true}
      >
        <MapInner {...props} />
      </MapContainer>
    </>
  );
}
