#!/usr/bin/env bun

/**
 * Self-Healing Build Script
 * Detects and fixes common build failures automatically
 */

import { exec } from 'child_process';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';

const PROJECT_ROOT = import.meta.dir;

// Autonomy levels - configurable via environment
const AUTONOMY_LEVEL = process.env.AUTONOMY_LEVEL || 'ask';
const AUTONOMY_CONFIG: Record<string, 'auto-fix' | 'escalate'> = {
  dependency: 'auto-fix',      // Missing packages
  type_error: 'auto-fix',       // TypeScript errors
  lint_violation: 'auto-fix',   // ESLint errors
  test_failure: 'escalate',     // Test failures (non-deterministic)
  build_error: 'escalate',      // Build errors (may need review)
};

// ============================================
// LOGGING
// ============================================

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
};

function log(level: string, message: string, color: string = colors.reset) {
  console.log(`${color}[${level}]${colors.reset} ${message}`);
}

function info(message: string) { log('INFO', message, colors.blue); }
function success(message: string) { log('SUCCESS', message, colors.green); }
function warn(message: string) { log('WARN', message, colors.yellow); }
function error(message: string) { log('ERROR', message, colors.red); }

// ============================================
// COMMAND EXECUTION
// ============================================

interface ExecResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
}

async function runCommand(cmd: string, cwd = PROJECT_ROOT): Promise<ExecResult> {
  return new Promise((resolve) => {
    exec(cmd, { cwd }, (err, stdout, stderr) => {
      resolve({
        success: err === null,
        stdout: stdout || '',
        stderr: stderr || '',
        exitCode: err?.code ?? 0,
      });
    });
  });
}

// ============================================
// FAILURE DETECTION & CLASSIFICATION
// ============================================

interface Failure {
  type: 'dependency' | 'type_error' | 'lint_violation' | 'test_failure' | 'build_error';
  message: string;
  details: string[];
}

function classifyFailure(output: string): Failure | null {
  // Dependency issues
  if (output.includes('Cannot find package') || 
      output.includes('Module not found') ||
      output.includes('ERR_MODULE_NOT_FOUND') ||
      output.match(/Package.*not found/i)) {
    const packages = extractPackageNames(output);
    return {
      type: 'dependency',
      message: 'Missing dependencies detected',
      details: packages.length > 0 ? packages : ['Unknown package'],
    };
  }

  // Type errors
  if (output.includes('TS') && output.includes('error') ||
      output.includes("Type '") && output.includes("' is not assignable") ||
      output.match(/TypeScript error/i)) {
    return {
      type: 'type_error',
      message: 'TypeScript errors detected',
      details: extractTypeErrors(output),
    };
  }

  // Lint violations
  if (output.includes('eslint') || 
      output.match(/\[eslint\].*error/i) ||
      output.includes('warning') && output.includes('prefer-')) {
    return {
      type: 'lint_violation',
      message: 'ESLint violations detected',
      details: extractLintErrors(output),
    };
  }

  // Test failures
  if (output.includes('FAIL') || 
      output.includes('Test failed') ||
      output.match(/\d+ tests? failed/i)) {
    return {
      type: 'test_failure',
      message: 'Test failures detected',
      details: extractTestFailures(output),
    };
  }

  // Build errors
  if (output.includes('Build failed') ||
      output.includes('Compilation failed') ||
      output.includes('NEXT')) {
    return {
      type: 'build_error',
      message: 'Build failed',
      details: [output.substring(0, 500)],
    };
  }

  return null;
}

function extractPackageNames(output: string): string[] {
  const matches = output.matchAll(/['"`]?(@[\w-]+\/[\w-]+|[\w-]+)['"`]?(?: not found|Cannot find)/gi);
  return [...matches].map(m => m[1]).filter((v, i, a) => a.indexOf(v) === i);
}

function extractTypeErrors(output: string): string[] {
  const errors: string[] = [];
  const lines = output.split('\n');
  for (const line of lines) {
    if (line.includes('TS') && line.includes('error')) {
      errors.push(line.trim().substring(0, 200));
    }
  }
  return errors.slice(0, 5);
}

function extractLintErrors(output: string): string[] {
  const errors: string[] = [];
  const lines = output.split('\n');
  for (const line of lines) {
    if (line.includes('[eslint]') || line.includes('warning')) {
      errors.push(line.trim().substring(0, 200));
    }
  }
  return errors.slice(0, 5);
}

function extractTestFailures(output: string): string[] {
  const errors: string[] = [];
  const lines = output.split('\n');
  for (const line of lines) {
    if (line.includes('FAIL') || line.includes('●')) {
      errors.push(line.trim());
    }
  }
  return errors.slice(0, 10);
}

// ============================================
// AUTO-FIX HANDLERS
// ============================================

async function installMissingDeps(packages: string[]): Promise<boolean> {
  if (packages.length === 0) return true;
  
  info(`Installing missing packages: ${packages.join(', ')}`);
  const result = await runCommand(`bun add ${packages.join(' ')}`);
  
  if (result.success) {
    success('Dependencies installed successfully');
  } else {
    error(`Failed to install: ${result.stderr}`);
  }
  
  return result.success;
}

async function fixTypeErrors(): Promise<boolean> {
  info('Running TypeScript type checking...');
  const result = await runCommand('bun tsc --noEmit');
  
  if (result.success) {
    success('TypeScript checks passed');
  } else {
    warn('TypeScript errors remain - manual review needed');
    console.log(result.stdout.substring(0, 1000));
  }
  
  return result.success;
}

async function fixLintViolations(): Promise<boolean> {
  info('Running ESLint with auto-fix...');
  const result = await runCommand('bun run lint --fix');
  
  if (result.success) {
    success('Lint issues fixed');
  } else {
    warn('Some lint issues may require manual review');
  }
  
  return result.success;
}

// ============================================
// MAIN SELF-HEAL LOGIC
// ============================================

interface HealResult {
  fixed: boolean;
  type: string;
  action: string;
  details: string;
}

async function attemptHeal(failure: Failure): Promise<HealResult> {
  const autonomy = AUTONOMY_CONFIG[failure.type];
  
  if (autonomy === 'escalate') {
    warn(`Escalating ${failure.type} - requires human review`);
    return {
      fixed: false,
      type: failure.type,
      action: 'escalate',
      details: failure.message,
    };
  }

  info(`Attempting auto-fix for ${failure.type}...`);
  let fixed = false;

  switch (failure.type) {
    case 'dependency':
      fixed = await installMissingDeps(failure.details as string[]);
      break;
    case 'type_error':
      fixed = await fixTypeErrors();
      break;
    case 'lint_violation':
      fixed = await fixLintViolations();
      break;
    default:
      warn(`No auto-fix handler for ${failure.type}`);
  }

  return {
    fixed,
    type: failure.type,
    action: fixed ? 'auto-fixed' : 'escalate',
    details: failure.message,
  };
}

async function runBuild(): Promise<ExecResult> {
  info('Running build...');
  return runCommand('bun run build');
}

async function main() {
  console.log(`\n${colors.magenta}═══════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.magenta}     Self-Healing Build Pipeline${colors.reset}`);
  console.log(`${colors.magenta}═══════════════════════════════════════════${colors.reset}\n`);
  
  console.log(`Autonomy Level: ${AUTONOMY_LEVEL}`);
  console.log(`Autonomy Config:`, AUTONOMY_CONFIG);
  console.log('');

  const buildResult = await runBuild();

  if (buildResult.success) {
    success('Build completed successfully!');
    process.exit(0);
  }

  // Build failed - try to heal
  error('Build failed. Analyzing failure...');
  console.log('\n--- Build Output ---');
  console.log(buildResult.stdout.substring(0, 2000));
  if (buildResult.stderr) {
    console.log('\n--- Errors ---');
    console.log(buildResult.stderr.substring(0, 1000));
  }
  console.log('--- End Output ---\n');

  const failure = classifyFailure(buildResult.stdout + buildResult.stderr);

  if (!failure) {
    error('Could not classify failure. Escalating for human review.');
    console.log('\nFull output for review:');
    console.log(buildResult.stdout);
    process.exit(1);
  }

  info(`Failure Type: ${failure.type}`);
  info(`Details: ${failure.details.join(', ')}`);

  const result = await attemptHeal(failure);

  if (result.action === 'escalate') {
    console.log(`\n${colors.yellow}═══════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.yellow}  ESCALATION REQUIRED${colors.reset}`);
    console.log(`${colors.yellow}═══════════════════════════════════════════${colors.reset}`);
    console.log(`Failure Type: ${result.type}`);
    console.log(`Reason: ${result.details}`);
    console.log('\nPlease review and fix manually.\n');
    process.exit(1);
  }

  // Retry build after healing
  if (result.fixed) {
    info('Retrying build after auto-fix...');
    const retryResult = await runBuild();
    
    if (retryResult.success) {
      success('Build successful after self-healing!');
      process.exit(0);
    } else {
      error('Build still failing after auto-fix. Escalating.');
      process.exit(1);
    }
  }
}

main().catch((err) => {
  error(`Unexpected error: ${err.message}`);
  process.exit(1);
});
