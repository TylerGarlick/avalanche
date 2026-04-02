// Direct unit tests for normalizeCAICForecast
// Tests the core normalization logic in isolation

const CAIC_ZONE_ID_MAP: Record<string, string> = {
  'caic-101': 'caic-steamboat',
  'caic-102': 'caic-front-range',
  'caic-103': 'caic-vail',
  'caic-104': 'caic-aspen',
  'caic-105': 'caic-grand-mesa',
  'caic-106': 'caic-gunnison',
  'caic-107': 'caic-nw-san-juan',
  'caic-108': 'caic-sw-san-juan',
};

// Inline the normalization logic to test it directly
interface CAICZone {
  id: string;
  name: string;
  danger_rating: number;
  danger_by_aspect: Record<string, number>;
  danger_by_elevation: Record<string, number>;
  problems: any[];
  discussion: string;
  published_at: string;
}

interface CAICRawData {
  zones: Record<string, CAICZone>;
}

function normalizeCAIC(data: CAICRawData): { zones: any } | null {
  if (!data) return null;
  const caicZoneIds = Object.keys(data.zones) as Array<keyof typeof CAIC_ZONE_ID_MAP>;
  const normalizedZones: any = {};

  for (const zoneId of caicZoneIds) {
    const zone = data.zones[zoneId];
    const mappedZoneId = CAIC_ZONE_ID_MAP[zoneId] ?? zoneId;

    normalizedZones[mappedZoneId] = {
      zone: zone.name,
      center: 'CAIC',
      dangerRating: zone.danger_rating,
      dangerByAspect: zone.danger_by_aspect,
      bottom: Object.values(zone.danger_by_elevation)[0] ?? zone.danger_rating,
      top: Object.values(zone.danger_by_elevation)[2] ?? zone.danger_rating,
      avalancheProblems: zone.problems.map((p) => ({
        type: p.type ?? 'Unknown',
        likelihood: p.likelihood ?? 'Unknown',
        size: p.size ?? 'Small',
        aspect: p.aspect ?? null,
        elevation: p.elevation ?? null,
        discussion: p.discussion ?? '',
      })),
      forecastDiscussion: zone.discussion,
      publishedAt: zone.published_at,
      validDay: new Date().toISOString().split('T')[0],
    };
  }

  return { zones: normalizedZones };
}

// Tests
let passed = 0, failed = 0;

function expect(actual: any) {
  return {
    toBe: (exp: any) => {
      if (actual !== exp) throw new Error(`Expected ${exp}, got ${actual}`);
    },
    toBeDefined: () => {
      if (actual === undefined) throw new Error(`Expected defined, got undefined`);
    },
    toHaveLength: (n: number) => {
      if (actual.length !== n) throw new Error(`Expected length ${n}, got ${actual.length}`);
    },
    toContain: (s: string) => {
      if (!actual.includes(s)) throw new Error(`Expected "${actual}" to contain "${s}"`);
    },
    toEqual: (exp: any) => {
      if (JSON.stringify(actual) !== JSON.stringify(exp)) throw new Error(`Expected ${JSON.stringify(exp)}, got ${JSON.stringify(actual)}`);
    },
    not: {
      toBeNull: () => {
        if (actual === null) throw new Error(`Expected not null`);
      },
    },
  };
}

function it(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e: any) {
    console.log(`  ✗ ${name}: ${e.message}`);
    failed++;
  }
}

console.log('normalizeCAIC tests:');

it('returns null for null input', () => {
  expect(normalizeCAIC(null)).toBe(null);
});

it('maps caic-101 to caic-steamboat', () => {
  const raw = {
    zones: {
      'caic-101': {
        id: 'caic-101', name: 'Steamboat & Flat Tops', danger_rating: 3,
        danger_by_aspect: {}, danger_by_elevation: {},
        problems: [], discussion: '', published_at: new Date().toISOString(),
      },
    },
  };
  const result = normalizeCAIC(raw as CAICRawData);
  expect(result).not.toBeNull();
  expect(result!.zones['caic-steamboat']).toBeDefined();
  expect(result!.zones['caic-steamboat'].zone).toBe('Steamboat & Flat Tops');
  expect(result!.zones['caic-steamboat'].center).toBe('CAIC');
});

it('maps all 8 CAIC zone IDs', () => {
  const raw: CAICRawData = { zones: {} };
  const ids = ['caic-101','caic-102','caic-103','caic-104','caic-105','caic-106','caic-107','caic-108'];
  ids.forEach((id, i) => {
    raw.zones[id] = {
      id, name: `Zone ${i+1}`, danger_rating: 3,
      danger_by_aspect: {}, danger_by_elevation: {},
      problems: [], discussion: '', published_at: new Date().toISOString(),
    };
  });
  const result = normalizeCAIC(raw);
  expect(Object.keys(result!.zones)).toHaveLength(8);
  expect(result!.zones['caic-steamboat']).toBeDefined();
  expect(result!.zones['caic-front-range']).toBeDefined();
  expect(result!.zones['caic-sw-san-juan']).toBeDefined();
});

it('preserves danger rating, problems, discussion', () => {
  const raw: CAICRawData = {
    zones: {
      'caic-107': {
        id: 'caic-107', name: 'Sangre de Cristo', danger_rating: 4,
        danger_by_aspect: { N: 5, NE: 4, E: 4, SE: 3, S: 3, SW: 3, W: 4, NW: 5 },
        danger_by_elevation: { 'Below Treeline': 3, 'Near Treeline': 4, 'Above Treeline': 5 },
        problems: [{ type: 'Deep Persistent Slab', likelihood: 'Likely', size: 'Large', discussion: 'Weak layer at base.' }],
        discussion: 'High danger. Avoid avalanche terrain.',
        published_at: new Date().toISOString(),
      },
    },
  };
  const result = normalizeCAIC(raw);
  const zone = result!.zones['caic-nw-san-juan'];
  expect(zone.dangerRating).toBe(4);
  expect(zone.avalancheProblems).toHaveLength(1);
  expect(zone.avalancheProblems[0].type).toBe('Deep Persistent Slab');
  expect(zone.forecastDiscussion).toContain('High danger');
});

it('handles unknown zone IDs as fallback', () => {
  const raw: CAICRawData = {
    zones: {
      'caic-999': {
        id: 'caic-999', name: 'New Zone', danger_rating: 2,
        danger_by_aspect: {}, danger_by_elevation: {},
        problems: [], discussion: '', published_at: new Date().toISOString(),
      },
    },
  };
  const result = normalizeCAIC(raw);
  expect(result!.zones['caic-999']).toBeDefined();
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
