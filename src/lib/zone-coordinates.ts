export interface ZoneCoordinate {
  zone: string;
  zoneId: string;
  center: 'CAIC' | 'UAC';
  lat: number;
  lng: number;
}

// Approximate center coordinates for all 15 avalanche forecast zones
// These represent the main forecast area centers
export const ZONE_COORDINATES: ZoneCoordinate[] = [
  // CAIC Zones (Colorado)
  {
    zone: 'Steamboat & Flat Tops',
    zoneId: 'caic-steamboat',
    center: 'CAIC',
    lat: 40.4850,
    lng: -106.8300,
  },
  {
    zone: 'Front Range',
    zoneId: 'caic-front-range',
    center: 'CAIC',
    lat: 39.7400,
    lng: -105.5900,
  },
  {
    zone: 'Vail & Summit County',
    zoneId: 'caic-vail',
    center: 'CAIC',
    lat: 39.6400,
    lng: -106.3700,
  },
  {
    zone: 'Aspen',
    zoneId: 'caic-aspen',
    center: 'CAIC',
    lat: 39.1900,
    lng: -106.8200,
  },
  {
    zone: 'Grand Mesa',
    zoneId: 'caic-grand-mesa',
    center: 'CAIC',
    lat: 39.0600,
    lng: -107.8900,
  },
  {
    zone: 'Gunnison',
    zoneId: 'caic-gunnison',
    center: 'CAIC',
    lat: 38.8600,
    lng: -106.9800,
  },
  {
    zone: 'Northwest San Juan',
    zoneId: 'caic-nw-san-juan',
    center: 'CAIC',
    lat: 37.9000,
    lng: -108.0500,
  },
  {
    zone: 'Southwest San Juan',
    zoneId: 'caic-sw-san-juan',
    center: 'CAIC',
    lat: 37.5000,
    lng: -108.4000,
  },
  // UAC Zones (Utah)
  {
    zone: 'Logan',
    zoneId: 'uac-logan',
    center: 'UAC',
    lat: 41.7400,
    lng: -111.8300,
  },
  {
    zone: 'Ogden',
    zoneId: 'uac-ogden',
    center: 'UAC',
    lat: 41.2600,
    lng: -111.9700,
  },
  {
    zone: 'Salt Lake',
    zoneId: 'uac-salt-lake',
    center: 'UAC',
    lat: 40.7700,
    lng: -111.9300,
  },
  {
    zone: 'Provo',
    zoneId: 'uac-provo',
    center: 'UAC',
    lat: 40.3400,
    lng: -111.6000,
  },
  {
    zone: 'Skyline',
    zoneId: 'uac-skyline',
    center: 'UAC',
    lat: 39.6500,
    lng: -111.2500,
  },
  {
    zone: 'Moab',
    zoneId: 'uac-moab',
    center: 'UAC',
    lat: 38.5700,
    lng: -109.5500,
  },
  {
    zone: 'Abajo',
    zoneId: 'uac-abajo',
    center: 'UAC',
    lat: 37.8400,
    lng: -109.1600,
  },
];

// Get zone coordinate by zoneId
export function getZoneCoordinate(zoneId: string): ZoneCoordinate | undefined {
  return ZONE_COORDINATES.find(z => z.zoneId === zoneId);
}

// Get zone coordinate by zone name
export function getZoneCoordinateByName(zone: string): ZoneCoordinate | undefined {
  return ZONE_COORDINATES.find(z => z.zone === zone);
}

// Map bounds to show all zones nicely
export const MAP_BOUNDS = {
  center: [39.5, -109.5] as [number, number],
  zoom: 6,
};

// Colorado/Utah region bounds
export const REGION_BOUNDS = {
  minLat: 37.0,
  maxLat: 42.0,
  minLng: -112.5,
  maxLng: -105.5,
};
