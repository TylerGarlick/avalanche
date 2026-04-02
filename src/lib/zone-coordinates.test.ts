import { describe, it, expect } from 'vitest';
import {
  ZONE_COORDINATES,
  getZoneCoordinate,
  getZoneCoordinateByName,
  MAP_BOUNDS,
  REGION_BOUNDS,
} from '@/lib/zone-coordinates';

describe('ZONE_COORDINATES', () => {
  it('has exactly 15 zones', () => {
    expect(ZONE_COORDINATES).toHaveLength(15);
  });

  it('has exactly 8 CAIC zones', () => {
    const caic = ZONE_COORDINATES.filter(z => z.center === 'CAIC');
    expect(caic).toHaveLength(8);
  });

  it('has exactly 7 UAC zones', () => {
    const uac = ZONE_COORDINATES.filter(z => z.center === 'UAC');
    expect(uac).toHaveLength(7);
  });

  it('each zone has required fields', () => {
    for (const zone of ZONE_COORDINATES) {
      expect(zone).toHaveProperty('zone');
      expect(zone).toHaveProperty('zoneId');
      expect(zone).toHaveProperty('center');
      expect(zone).toHaveProperty('lat');
      expect(zone).toHaveProperty('lng');
      expect(typeof zone.lat).toBe('number');
      expect(typeof zone.lng).toBe('number');
    }
  });

  it('zone IDs are properly prefixed', () => {
    for (const zone of ZONE_COORDINATES) {
      if (zone.center === 'CAIC') {
        expect(zone.zoneId).toMatch(/^caic-/);
      } else {
        expect(zone.zoneId).toMatch(/^uac-/);
      }
    }
  });

  it('all zone IDs are unique', () => {
    const ids = ZONE_COORDINATES.map(z => z.zoneId);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('known zone IDs are present', () => {
    const expected = [
      'caic-steamboat', 'caic-front-range', 'caic-vail', 'caic-aspen',
      'caic-grand-mesa', 'caic-gunnison', 'caic-nw-san-juan', 'caic-sw-san-juan',
      'uac-logan', 'uac-ogden', 'uac-salt-lake', 'uac-provo',
      'uac-skyline', 'uac-moab', 'uac-abajo',
    ];
    const actual = ZONE_COORDINATES.map(z => z.zoneId).sort();
    expect(actual).toEqual(expected.sort());
  });

  it('coordinates are in valid ranges (Colorado + Utah)', () => {
    for (const zone of ZONE_COORDINATES) {
      expect(zone.lat).toBeGreaterThanOrEqual(36);
      expect(zone.lat).toBeLessThanOrEqual(42);
      expect(zone.lng).toBeGreaterThanOrEqual(-113);
      expect(zone.lng).toBeLessThanOrEqual(-104);
    }
  });
});

describe('getZoneCoordinate', () => {
  it('returns zone for valid CAIC zoneId', () => {
    const zone = getZoneCoordinate('caic-steamboat');
    expect(zone).toBeDefined();
    expect(zone!.zoneId).toBe('caic-steamboat');
    expect(zone!.center).toBe('CAIC');
  });

  it('returns zone for valid UAC zoneId', () => {
    const zone = getZoneCoordinate('uac-salt-lake');
    expect(zone).toBeDefined();
    expect(zone!.zoneId).toBe('uac-salt-lake');
    expect(zone!.center).toBe('UAC');
  });

  it('returns undefined for invalid zoneId', () => {
    expect(getZoneCoordinate('invalid-zone')).toBeUndefined();
    expect(getZoneCoordinate('')).toBeUndefined();
  });
});

describe('getZoneCoordinateByName', () => {
  it('returns zone for valid zone name', () => {
    const zone = getZoneCoordinateByName('Steamboat & Flat Tops');
    expect(zone).toBeDefined();
    expect(zone!.zoneId).toBe('caic-steamboat');
  });

  it('returns undefined for invalid name', () => {
    expect(getZoneCoordinateByName('Nonexistent Zone')).toBeUndefined();
  });
});

describe('MAP_BOUNDS', () => {
  it('has center array and zoom', () => {
    expect(MAP_BOUNDS).toHaveProperty('center');
    expect(Array.isArray(MAP_BOUNDS.center)).toBe(true);
    expect(MAP_BOUNDS.center).toHaveLength(2);
    expect(MAP_BOUNDS.zoom).toBeGreaterThan(0);
  });

  it('center is valid lat/lng', () => {
    const [lat, lng] = MAP_BOUNDS.center;
    expect(lat).toBeGreaterThanOrEqual(36);
    expect(lat).toBeLessThanOrEqual(42);
    expect(lng).toBeGreaterThanOrEqual(-113);
    expect(lng).toBeLessThanOrEqual(-104);
  });
});

describe('REGION_BOUNDS', () => {
  it('has minLat, maxLat, minLng, maxLng', () => {
    expect(REGION_BOUNDS).toHaveProperty('minLat');
    expect(REGION_BOUNDS).toHaveProperty('maxLat');
    expect(REGION_BOUNDS).toHaveProperty('minLng');
    expect(REGION_BOUNDS).toHaveProperty('maxLng');
  });

  it('maxLat > minLat and maxLng > minLng', () => {
    expect(REGION_BOUNDS.maxLat).toBeGreaterThan(REGION_BOUNDS.minLat);
    expect(REGION_BOUNDS.maxLng).toBeGreaterThan(REGION_BOUNDS.minLng);
  });
});
