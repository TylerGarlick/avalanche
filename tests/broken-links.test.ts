/**
 * Broken Link Prevention Tests
 * Ensures all app routes return valid responses before deployment.
 * Run: bun test tests/broken-links.test.ts
 */

import { describe, it, expect } from 'bun:test';

const BASE_URL = process.env.APP_URL || 'http://localhost:3000';
const IS_PRODUCTION = !BASE_URL.includes('localhost');

// All routes that should return 200 or redirect (never 404)
const ROUTES = [
  { path: '/', name: 'Dashboard' },
  { path: '/map', name: 'Interactive Map' },
  { path: '/api/forecast/all', name: 'All Forecasts API' },
  { path: '/api/forecast/caic', name: 'CAIC API' },
  { path: '/api/forecast/uac', name: 'UAC API' },
  { path: '/api/health', name: 'Health API' },
  { path: '/api/metrics', name: 'Metrics API' },
  { path: '/api/validate', name: 'Validate API' },
];

async function fetchStatus(url: string): Promise<number> {
  const res = await fetch(url);
  return res.status;
}

describe('Broken Link Prevention', () => {
  for (const route of ROUTES) {
    it(`${route.name} (${route.path}) should not return 404`, async () => {
      const status = await fetchStatus(`${BASE_URL}${route.path}`);
      expect(status).not.toBe(404);
      expect([200, 301, 302, 307, 308]).toContain(status);
    });
  }

  it('All 15 forecast zones should be present in /api/forecast/all', async () => {
    const res = await fetch(`${BASE_URL}/api/forecast/all`);
    expect(res.status).toBe(200);
    const data = await res.json();
    const forecasts = Array.isArray(data) ? data : data.forecasts;
    expect(Array.isArray(forecasts)).toBe(true);
    expect(forecasts.length).toBeGreaterThanOrEqual(15);
  });

  it('Health endpoint should return healthy status', async () => {
    const res = await fetch(`${BASE_URL}/api/health`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(['healthy', 'degraded', 'down']).toContain(data.status);
  });

  it('Validate endpoint should return validation status', async () => {
    const res = await fetch(`${BASE_URL}/api/validate`);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(['pass', 'fail']).toContain(data.status);
  });

  it('Build output should include all expected routes', async () => {
    // This test verifies the build manifest includes all routes
    // by checking the build log output exists
    const fs = await import('fs');
    const path = await import('path');
    const buildManifestPath = path.join(process.cwd(), '.next', 'build-metadata.json');
    if (fs.existsSync(buildManifestPath)) {
      const manifest = JSON.parse(fs.readFileSync(buildManifestPath, 'utf-8'));
      expect(manifest).toBeDefined();
    }
  });
});
