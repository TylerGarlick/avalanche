import { describe, it, expect } from 'vitest';
import { normalizeUAC } from '@/lib/normalize-uac';
import type { UnifiedForecast } from '@/lib/normalize-uac';

describe('normalizeUAC', () => {
  it('returns null for null input', () => {
    expect(normalizeUAC(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(normalizeUAC(undefined)).toBeNull();
  });

  it('normalizes UAC data into UnifiedForecast array', () => {
    const raw = {
      advisories: [
        {
          advisory: {
            region: 'Salt Lake',
            Nid: '103614',
            bottom_elevation: 7500,
            top_elevation: 11000,
            danger: 3,
            problems: [],
          },
        },
      ],
    };

    const result = normalizeUAC(raw as any);
    expect(result).not.toBeNull();
    expect(Array.isArray(result)).toBe(true);
  });

  it('maps UAC Nid to canonical zone ID', () => {
    const raw = {
      advisories: [
        {
          advisory: {
            region: 'Salt Lake',
            Nid: '103614',
            bottom_elevation: 7500,
            top_elevation: 11000,
            danger: 3,
            problems: [],
          },
        },
      ],
    };

    const result = normalizeUAC(raw as any);
    expect(result![0].zoneId).toMatch(/^uac-/);
  });

  it('extracts avalanche problems', () => {
    const raw = {
      advisories: [
        {
          advisory: {
            region: 'Provo',
            Nid: '103619',
            bottom_elevation: 7000,
            top_elevation: 10500,
            danger: 4,
            problems: [
              {
                type: 'Wind Slab',
                likelihood: 'likely',
                size: 'large',
                discussion: 'Natural avalanches possible.',
              },
              {
                type: 'Deep Slab',
                likelihood: 'possible',
                size: 'very_large',
                discussion: 'Persistent weak layer.',
              },
            ],
          },
        },
      ],
    };

    const result = normalizeUAC(raw as any);
    expect(result![0].problems).toHaveLength(2);
    expect(result![0].problems[0].type).toBe('Wind Slab');
    expect(result![0].problems[0].likelihood).toBe('likely');
    expect(result![0].problems[1].type).toBe('Deep Slab');
  });

  it('returns null for empty advisories', () => {
    const raw = { advisories: [] };
    expect(normalizeUAC(raw as any)).toBeNull();
  });

  it('returns empty array when advisory lacks Nid', () => {
    const raw = {
      advisories: [
        { advisory: { region: 'Test', danger: 3, problems: [] } },
      ],
    };
    expect(normalizeUAC(raw as any)).toEqual([]);
  });
});
