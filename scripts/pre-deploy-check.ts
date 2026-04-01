#!/usr/bin/env bun

/**
 * Pre-Deploy Link Check
 * Verifies all routes return valid responses before deployment.
 * Run automatically before `vercel --prod` deploy.
 */

const BASE_URL = process.env.APP_URL || 'http://localhost:3000';

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

async function checkRoutes(): Promise<void> {
  let passed = 0;
  let failed = 0;

  console.log(`\n🔍 Checking routes at ${BASE_URL}\n`);

  for (const route of ROUTES) {
    try {
      const res = await fetch(`${BASE_URL}${route.path}`);
      if (res.status === 404) {
        console.log(`❌ ${route.name} (${route.path}) — 404 NOT FOUND`);
        failed++;
      } else if ([200, 301, 302, 307, 308].includes(res.status)) {
        console.log(`✅ ${route.name} (${route.path}) — ${res.status}`);
        passed++;
      } else {
        console.log(`⚠️  ${route.name} (${route.path}) — ${res.status}`);
        failed++;
      }
    } catch (err: any) {
      console.log(`❌ ${route.name} (${route.path}) — CONNECTION FAILED: ${err.message}`);
      failed++;
    }
  }

  console.log(`\n${'─'.repeat(40)}`);
  console.log(`Results: ${passed} passed, ${failed} failed\n`);

  if (failed > 0) {
    console.log('🚫 Aborting deploy — broken links detected.\n');
    process.exit(1);
  } else {
    console.log('✅ All routes OK — safe to deploy.\n');
    process.exit(0);
  }
}

checkRoutes();
