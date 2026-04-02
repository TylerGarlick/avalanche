// Vitest setup — extends Jest expect with @testing-library/jest-dom matchers
import { expect, vi } from 'vitest';
import * as jestDom from '@testing-library/jest-dom';

// Extend Vitest's expect with Jest DOM matchers
expect.extend(jestDom);

// Mock Next.js headers/cookies for API route tests
vi.mock('next/headers', () => ({
  headers: vi.fn(() => new Map()),
  cookies: vi.fn(() => ({ get: vi.fn(), set: vi.fn(), delete: vi.fn() })),
}));

// Mock console.error to keep test output clean (except on unexpected errors)
// We use a custom filter in tests to allow expected error assertions
const originalError = console.error;
console.error = (...args: Parameters<typeof console.error>) => {
  if (
    typeof args[0] === 'string' &&
    (args[0].includes('Warning:') || args[0].includes('React does not recognize'))
  ) {
    return; // Suppress React warnings in tests
  }
  originalError.call(console, ...args);
};
