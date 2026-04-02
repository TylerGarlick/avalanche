import { describe, it, expect } from 'vitest';
import normalizeCAICForecast from '@/lib/normalize-caic';

describe('normalizeCAICForecast', () => {
  it('returns null for null input', () => {
    expect(normalizeCAICForecast(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(normalizeCAICForecast(undefined)).toBeNull();
  });

  it('maps caic-101 to caic-steamboat', () => {
    const raw = {
      zones: {
        'caic-101': {
          id: 'caic-101',
          name: 'Steamboat & Flat Tops',
          danger_rating: 3,
          danger_by_aspect: { N: 3, NE: 4, E: 3, SE: 2, S: 2, SW: 3, W: 4, NW: 4 },
          danger_by_elevation: { 'Below Treeline': 2, 'Near Treeline': 3, 'Above Treeline': 4 },
          problems: [],
          discussion: '',
          published_at: new Date().toISOString(),
        },
      },
    };

    const result = normalizeCAICForecast(raw as any);
    expect(result).not.toBeNull();
    expect(result!.zones['caic-steamboat']).toBeDefined();
    expect(result!.zones['caic-steamboat'].zone).toBe('Steamboat & Flat Tops');
    expect(result!.zones['caic-steamboat'].center).toBe('CAIC');
  });

  it('maps all 8 CAIC zone IDs', () => {
    const raw = {
      zones: {
        'caic-101': { id: 'caic-101', name: 'Steamboat', danger_rating: 3, danger_by_aspect: {}, danger_by_elevation: {}, problems: [], discussion: '', published_at: new Date().toISOString() },
        'caic-102': { id: 'caic-102', name: 'Front Range', danger_rating: 3, danger_by_aspect: {}, danger_by_elevation: {}, problems: [], discussion: '', published_at: new Date().toISOString() },
        'caic-103': { id: 'caic-103', name: 'Vail', danger_rating: 3, danger_by_aspect: {}, danger_by_elevation: {}, problems: [], discussion: '', published_at: new Date().toISOString() },
        'caic-104': { id: 'caic-104', name: 'Aspen', danger_rating: 3, danger_by_aspect: {}, danger_by_elevation: {}, problems: [], discussion: '', published_at: new Date().toISOString() },
        'caic-105': { id: 'caic-105', name: 'Grand Mesa', danger_rating: 3, danger_by_aspect: {}, danger_by_elevation: {}, problems: [], discussion: '', published_at: new Date().toISOString() },
        'caic-106': { id: 'caic-106', name: 'Gunnison', danger_rating: 3, danger_by_aspect: {}, danger_by_elevation: {}, problems: [], discussion: '', published_at: new Date().toISOString() },
        'caic-107': { id: 'caic-107', name: 'NW San Juan', danger_rating: 3, danger_by_aspect: {}, danger_by_elevation: {}, problems: [], discussion: '', published_at: new Date().toISOString() },
        'caic-108': { id: 'caic-108', name: 'SW San Juan', danger_rating: 3, danger_by_aspect: {}, danger_by_elevation: {}, problems: [], discussion: '', published_at: new Date().toISOString() },
      },
    };

    const result = normalizeCAICForecast(raw as any);
    expect(Object.keys(result!.zones)).toHaveLength(8);
    expect(result!.zones['caic-steamboat']).toBeDefined();
    expect(result!.zones['caic-front-range']).toBeDefined();
    expect(result!.zones['caic-sw-san-juan']).toBeDefined();
  });

  it('preserves danger rating, problems, discussion', () => {
    const raw = {
      zones: {
        'caic-107': {
          id: 'caic-107',
          name: 'Sangre de Cristo',
          danger_rating: 4,
          danger_by_aspect: { N: 5, NE: 4, E: 4, SE: 3, S: 3, SW: 3, W: 4, NW: 5 },
          danger_by_elevation: { 'Below Treeline': 3, 'Near Treeline': 4, 'Above Treeline': 5 },
          problems: [
            { type: 'Deep Persistent Slab', likelihood: 'Likely', size: 'Large', discussion: 'Weak layer at base.' },
          ],
          discussion: 'High danger. Avoid avalanche terrain.',
          published_at: new Date().toISOString(),
        },
      },
    };

    const result = normalizeCAICForecast(raw as any);
    const zone = result!.zones['caic-nw-san-juan'];
    expect(zone.dangerRating).toBe(4);
    expect(zone.avalancheProblems).toHaveLength(1);
    expect(zone.avalancheProblems[0].type).toBe('Deep Persistent Slab');
    expect(zone.forecastDiscussion).toContain('High danger');
  });

  it('handles unknown zone IDs as fallback', () => {
    const raw = {
      zones: {
        'caic-999': {
          id: 'caic-999',
          name: 'New Zone',
          danger_rating: 2,
          danger_by_aspect: {},
          danger_by_elevation: {},
          problems: [],
          discussion: '',
          published_at: new Date().toISOString(),
        },
      },
    };

    const result = normalizeCAICForecast(raw as any);
    expect(result!.zones['caic-999']).toBeDefined();
  });
});
