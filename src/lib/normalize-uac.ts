import { UnifiedForecast, AvalancheProblem, DangerLevel } from './types';

interface UACAdvisory {
  date_issued: string;
  date_issued_timestamp: string;
  overall_danger_rating: string;
  region: string;
  Nid: string;
  avalanche_problem_1?: string;
  avalanche_problem_1_description?: string;
  avalanche_problem_2?: string;
  avalanche_problem_2_description?: string;
  avalanche_problem_3?: string;
  avalanche_problem_3_description?: string;
  bottom_line?: string;
  current_conditions?: string;
  danger_rose_1?: string;
  danger_rose_2?: string;
  danger_rose_3?: string;
  overall_danger_rose?: string;
}

function parseDangerRating(rating: string): 1 | 2 | 3 | 4 | 5 {
  const lower = rating.toLowerCase();
  if (lower.includes('low')) return 1;
  if (lower.includes('moderate')) return 2;
  if (lower.includes('considerable')) return 3;
  if (lower.includes('high')) return 4;
  if (lower.includes('extreme')) return 5;
  return 2; // default to moderate
}

function parseDangerRose(rose: string, index: number): number {
  const values = rose.split(',').map(v => parseInt(v.trim(), 10));
  // Danger rose has 24 values for 8 aspects x 3 elevations
  // Order: N, NE, E, SE, S, SW, W, NW (each repeated for 3 elevations)
  const aspectIndex = index % 8;
  const elevationIndex = Math.floor(index / 8);
  const value = values[elevationIndex * 8 + aspectIndex] || 0;
  // Convert 0-16 scale to 1-5
  if (value === 0) return 0;
  if (value <= 4) return 1;
  if (value <= 8) return 2;
  if (value <= 12) return 3;
  if (value <= 14) return 4;
  return 5;
}

function extractProblems(advisory: UACAdvisory): AvalancheProblem[] {
  const problems: AvalancheProblem[] = [];

  if (advisory.avalanche_problem_1 && advisory.avalanche_problem_1_description) {
    problems.push({
      type: advisory.avalanche_problem_1,
      likelihood: 'Possible',
      size: 'Small to Large',
      discussion: advisory.avalanche_problem_1_description,
    });
  }

  if (advisory.avalanche_problem_2 && advisory.avalanche_problem_2_description) {
    problems.push({
      type: advisory.avalanche_problem_2,
      likelihood: 'Possible',
      size: 'Small to Large',
      discussion: advisory.avalanche_problem_2_description,
    });
  }

  if (advisory.avalanche_problem_3 && advisory.avalanche_problem_3_description) {
    problems.push({
      type: advisory.avalanche_problem_3,
      likelihood: 'Possible',
      size: 'Small to Large',
      discussion: advisory.avalanche_problem_3_description,
    });
  }

  return problems;
}

export function normalizeUAC(data: { advisories: Array<{ advisory: UACAdvisory }> }): UnifiedForecast[] {
  return data.advisories.map(({ advisory }) => {
    const dangerRating = parseDangerRating(advisory.overall_danger_rating || 'Moderate');
    const validDay = new Date(parseInt(advisory.date_issued_timestamp, 10) * 1000)
      .toISOString()
      .split('T')[0];

    // Parse danger rose (24 values: 8 aspects x 3 elevations)
    const dangerByAspect: Record<string, number> = {};
    const dangerByElevation: Record<string, number> = {};
    const aspects = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const elevations = ['Below Treeline', 'Near Treeline', 'Above Treeline'];

    if (advisory.overall_danger_rose) {
      const values = advisory.overall_danger_rose.split(',').map(v => parseInt(v.trim(), 10));
      
      // Average by aspect
      for (let i = 0; i < 8; i++) {
        const aspectValues = [values[i], values[i + 8], values[i + 16]].filter(v => !isNaN(v));
        dangerByAspect[aspects[i]] = aspectValues.length > 0
          ? Math.round(aspectValues.reduce((a, b) => a + b, 0) / aspectValues.length)
          : dangerRating;
      }

      // Average by elevation
      for (let e = 0; e < 3; e++) {
        const elevValues = values.slice(e * 8, (e + 1) * 8).filter(v => !isNaN(v));
        dangerByElevation[elevations[e]] = elevValues.length > 0
          ? Math.round(elevValues.reduce((a, b) => a + b, 0) / elevValues.length)
          : dangerRating;
      }
    }

    return {
      zone: advisory.region,
      zoneId: `uac-${advisory.Nid}`,
      center: 'UAC' as const,
      dangerRating,
      dangerByAspect,
      dangerByElevation,
      avalancheProblems: extractProblems(advisory),
      forecastDiscussion: advisory.bottom_line || advisory.current_conditions || '',
      publishedAt: new Date(parseInt(advisory.date_issued_timestamp, 10) * 1000).toISOString(),
      validDay,
      epistemic: 'inferred' as const,
    };
  });
}
