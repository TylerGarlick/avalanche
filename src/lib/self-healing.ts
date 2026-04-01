/**
 * Self-Healing Infrastructure
 * Circuit breaker, exponential backoff, caching, metrics, and drift detection
 */

import { UnifiedForecast } from './types';

// ============================================
// METRICS SYSTEM
// ============================================

export interface SystemMetrics {
  heal_success_rate: number;
  heal_attempts: number;
  heal_successes: number;
  drift_detection_count: number;
  circuit_breaker_trips: number;
  cache_hit_count: number;
  cache_miss_count: number;
  remediation_cycle_time_ms: number;
  last_failure_detected_at: string | null;
  last_healed_at: string | null;
}

class MetricsCollector {
  private metrics: SystemMetrics = {
    heal_success_rate: 1.0,
    heal_attempts: 0,
    heal_successes: 0,
    drift_detection_count: 0,
    circuit_breaker_trips: 0,
    cache_hit_count: 0,
    cache_miss_count: 0,
    remediation_cycle_time_ms: 0,
    last_failure_detected_at: null,
    last_healed_at: null,
  };

  private remediationStartTime: number | null = null;

  recordHealAttempt(): void {
    this.metrics.heal_attempts++;
    this.updateSuccessRate();
  }

  recordHealSuccess(): void {
    this.metrics.heal_successes++;
    this.metrics.last_healed_at = new Date().toISOString();
    if (this.remediationStartTime) {
      const cycleTime = Date.now() - this.remediationStartTime;
      this.metrics.remediation_cycle_time_ms = cycleTime;
      this.remediationStartTime = null;
    }
    this.updateSuccessRate();
  }

  recordFailure(): void {
    this.metrics.last_failure_detected_at = new Date().toISOString();
    if (!this.remediationStartTime) {
      this.remediationStartTime = Date.now();
    }
    this.recordHealAttempt();
  }

  recordDrift(): void {
    this.metrics.drift_detection_count++;
  }

  recordCircuitBreakerTrip(): void {
    this.metrics.circuit_breaker_trips++;
  }

  recordCacheHit(): void {
    this.metrics.cache_hit_count++;
  }

  recordCacheMiss(): void {
    this.metrics.cache_miss_count++;
  }

  private updateSuccessRate(): void {
    if (this.metrics.heal_attempts > 0) {
      this.metrics.heal_success_rate = this.metrics.heal_successes / this.metrics.heal_attempts;
    }
  }

  getMetrics(): SystemMetrics {
    return { ...this.metrics };
  }

  getCacheHitRate(): number {
    const total = this.metrics.cache_hit_count + this.metrics.cache_miss_count;
    return total > 0 ? this.metrics.cache_hit_count / total : 0;
  }
}

export const metrics = new MetricsCollector();

// ============================================
// CACHE SYSTEM WITH STALE INDICATORS
// ============================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  isStale: boolean;
}

class DataCache {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private staleIndicators: Map<string, { source: string; reason: string; since: string }> = new Map();

  set<T>(key: string, data: T, isStale = false): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      isStale,
    });
    if (isStale) {
      this.staleIndicators.set(key, {
        source: key,
        reason: 'Live fetch failed, serving cached data',
        since: new Date().toISOString(),
      });
    } else {
      this.staleIndicators.delete(key);
    }
  }

  get<T>(key: string): CacheEntry<T> | null {
    return (this.cache.get(key) as CacheEntry<T>) ?? null;
  }

  getStaleIndicator(key: string) {
    return this.staleIndicators.get(key) ?? null;
  }

  getAllStaleIndicators() {
    return Array.from(this.staleIndicators.values());
  }

  isHealthy(key: string, maxAgeMs: number): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    return Date.now() - entry.timestamp < maxAgeMs;
  }
}

export const dataCache = new DataCache();

// ============================================
// CIRCUIT BREAKER
// ============================================

type CircuitState = 'closed' | 'open' | 'half-open';

interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeoutMs: number;
  name: string;
}

class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failureCount = 0;
  private lastFailureTime: number | null = null;
  private config: CircuitBreakerConfig;

  constructor(config: CircuitBreakerConfig) {
    this.config = config;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      if (this.shouldAttemptReset()) {
        this.state = 'half-open';
      } else {
        metrics.recordCircuitBreakerTrip();
        throw new Error(`Circuit breaker OPEN for ${this.config.name}`);
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    this.state = 'closed';
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.config.failureThreshold) {
      this.state = 'open';
      metrics.recordCircuitBreakerTrip();
    }
  }

  private shouldAttemptReset(): boolean {
    if (!this.lastFailureTime) return true;
    return Date.now() - this.lastFailureTime > this.config.resetTimeoutMs;
  }

  getState(): CircuitState {
    return this.state;
  }

  getFailureCount(): number {
    return this.failureCount;
  }

  reset(): void {
    this.state = 'closed';
    this.failureCount = 0;
    this.lastFailureTime = null;
  }
}

// Create circuit breakers for each source
export const uacCircuitBreaker = new CircuitBreaker({
  name: 'UAC',
  failureThreshold: 3,
  resetTimeoutMs: 5 * 60 * 1000, // 5 minutes
});

export const caicCircuitBreaker = new CircuitBreaker({
  name: 'CAIC',
  failureThreshold: 3,
  resetTimeoutMs: 5 * 60 * 1000, // 5 minutes
});

// ============================================
// EXPONENTIAL BACKOFF RETRY
// ============================================

interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

export async function withRetry<T>(
  fn: () => Promise<T>,
  config: RetryConfig = { maxRetries: 3, baseDelayMs: 1000, maxDelayMs: 10000 }
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      if (attempt < config.maxRetries) {
        const delay = Math.min(
          config.baseDelayMs * Math.pow(2, attempt),
          config.maxDelayMs
        );
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================
// SCHEMA VALIDATION & DRIFT DETECTION
// ============================================

export interface ValidationError {
  field: string;
  expected: string;
  received: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  timestamp: string;
  source: string;
}

class DriftDetector {
  private validationHistory: ValidationResult[] = [];
  private readonly maxHistory = 100;

  validate(data: unknown, source: string): ValidationResult {
    const result = this.validateSchema(data, source);
    this.validationHistory.push(result);

    if (this.validationHistory.length > this.maxHistory) {
      this.validationHistory.shift();
    }

    if (!result.valid) {
      metrics.recordDrift();
    }

    return result;
  }

  private validateSchema(data: unknown, source: string): ValidationResult {
    const errors: ValidationError[] = [];
    const timestamp = new Date().toISOString();

    if (!data || typeof data !== 'object') {
      return {
        valid: false,
        errors: [{ field: 'root', expected: 'object', received: typeof data }],
        timestamp,
        source,
      };
    }

    const record = data as Record<string, unknown>;

    // Check required UnifiedForecast fields
    const requiredFields: Array<{ field: string; type: string }> = [
      { field: 'zone', type: 'string' },
      { field: 'zoneId', type: 'string' },
      { field: 'center', type: 'string' },
      { field: 'dangerRating', type: 'number' },
      { field: 'dangerByAspect', type: 'object' },
      { field: 'dangerByElevation', type: 'object' },
      { field: 'avalancheProblems', type: 'object' },
      { field: 'forecastDiscussion', type: 'string' },
      { field: 'publishedAt', type: 'string' },
      { field: 'validDay', type: 'string' },
    ];

    for (const { field, type } of requiredFields) {
      const value = record[field];
      const actualType = typeof value;

      if (value === undefined || value === null) {
        errors.push({
          field,
          expected: type,
          received: 'undefined/null',
        });
      } else if (field === 'dangerRating' && ![1, 2, 3, 4, 5].includes(Number(value))) {
        errors.push({
          field,
          expected: '1-5',
          received: String(value),
        });
      } else if (actualType !== type && !(field === 'avalancheProblems' && Array.isArray(value))) {
        errors.push({
          field,
          expected: type,
          received: actualType,
        });
      }
    }

    // Check center field
    if (record.center && !['CAIC', 'UAC'].includes(record.center as string)) {
      errors.push({
        field: 'center',
        expected: 'CAIC or UAC',
        received: record.center as string,
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      timestamp,
      source,
    };
  }

  getValidationHistory() {
    return this.validationHistory;
  }

  getLatestValidation(source?: string) {
    const filtered = source
      ? this.validationHistory.filter(v => v.source === source)
      : this.validationHistory;
    return filtered[filtered.length - 1] ?? null;
  }
}

export const driftDetector = new DriftDetector();

// ============================================
// API SOURCE HEALTH TRACKER
// ============================================

export interface SourceHealth {
  name: string;
  url: string;
  status: 'healthy' | 'degraded' | 'down';
  lastSuccessfulFetch: string | null;
  lastFailedFetch: string | null;
  consecutiveFailures: number;
  circuitState: CircuitState;
  isStaleData: boolean;
  staleReason: string | null;
}

class HealthTracker {
  private sources: Map<string, SourceHealth> = new Map();

  registerSource(name: string, url: string): void {
    this.sources.set(name, {
      name,
      url,
      status: 'healthy',
      lastSuccessfulFetch: null,
      lastFailedFetch: null,
      consecutiveFailures: 0,
      circuitState: 'closed',
      isStaleData: false,
      staleReason: null,
    });
  }

  recordSuccess(name: string): void {
    const source = this.sources.get(name);
    if (source) {
      source.lastSuccessfulFetch = new Date().toISOString();
      source.consecutiveFailures = 0;
      source.isStaleData = false;
      source.staleReason = null;
      source.status = 'healthy';
      source.circuitState = 'closed';
    }
  }

  recordFailure(name: string, reason: string): void {
    const source = this.sources.get(name);
    if (source) {
      source.lastFailedFetch = new Date().toISOString();
      source.consecutiveFailures++;

      if (source.consecutiveFailures >= 3) {
        source.status = 'down';
        source.isStaleData = true;
        source.staleReason = reason;
      } else {
        source.status = 'degraded';
      }
    }
    metrics.recordFailure();
  }

  setCircuitState(name: string, state: CircuitState): void {
    const source = this.sources.get(name);
    if (source) {
      source.circuitState = state;
    }
  }

  getHealth(name?: string): SourceHealth | SourceHealth[] {
    if (name) {
      return this.sources.get(name) ?? {
        name,
        url: '',
        status: 'down',
        lastSuccessfulFetch: null,
        lastFailedFetch: null,
        consecutiveFailures: 0,
        circuitState: 'closed' as CircuitState,
        isStaleData: true,
        staleReason: 'Source not registered',
      };
    }
    return Array.from(this.sources.values());
  }

  getOverallStatus(): 'healthy' | 'degraded' | 'down' {
    const allHealth = Array.from(this.sources.values());
    if (allHealth.length === 0) return 'down';

    const hasDown = allHealth.some(s => s.status === 'down');
    const hasDegraded = allHealth.some(s => s.status === 'degraded');

    if (hasDown) return 'down';
    if (hasDegraded) return 'degraded';
    return 'healthy';
  }
}

export const healthTracker = new HealthTracker();

// Initialize health tracking for both sources
healthTracker.registerSource('UAC', 'https://utahavalanchecenter.org/forecast/{zone}/json');
healthTracker.registerSource('CAIC', 'https://api.avalanche.state.co.us/');
