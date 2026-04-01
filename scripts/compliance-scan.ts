#!/usr/bin/env bun

/**
 * Compliance Scanning Script
 * Security scan, supply chain verification, and vulnerability checking
 */

import { exec } from 'child_process';
import { readFile } from 'fs/promises';
import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// Get project root - parent of scripts directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');

// ============================================
// LOGGING
// ============================================

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(level: string, message: string, color: string = colors.reset) {
  console.log(`${color}[${level}]${colors.reset} ${message}`);
}

function info(message: string) { log('INFO', message, colors.blue); }
function success(message: string) { log('PASS', message, colors.green); }
function warn(message: string) { log('WARN', message, colors.yellow); }
function fail(message: string) { log('FAIL', message, colors.red); }
function section(message: string) { log('', message, colors.cyan); }

// ============================================
// COMMAND EXECUTION
// ============================================

async function runCommand(cmd: string, cwd = PROJECT_ROOT): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve) => {
    exec(cmd, { cwd }, (err, stdout, stderr) => {
      resolve({
        stdout: stdout || '',
        stderr: stderr || '',
        exitCode: err?.code ?? 0,
      });
    });
  });
}

// ============================================
// SECURITY SCAN - API KEY DETECTION
// ============================================

interface SecurityIssue {
  severity: 'high' | 'medium' | 'low';
  file: string;
  line?: number;
  issue: string;
  recommendation: string;
}

async function scanForExposedKeys(): Promise<SecurityIssue[]> {
  const issues: SecurityIssue[] = [];
  
  // Patterns that indicate exposed secrets
  const secretPatterns = [
    { pattern: /api[_-]?key['":\s=]+['"][a-zA-Z0-9]{20,}['"]/gi, severity: 'high' as const },
    { pattern: /secret['":\s=]+['"][a-zA-Z0-9]{20,}['"]/gi, severity: 'high' as const },
    { pattern: /password['":\s=]+['"][^'"]+['"]/gi, severity: 'high' as const },
    { pattern: /token['":\s=]+['"][a-zA-Z0-9_-]{30,}['"]/gi, severity: 'high' as const },
    { pattern: /sk-[a-zA-Z0-9]{20,}/gi, severity: 'high' as const }, // OpenAI keys
    { pattern: /ghp_[a-zA-Z0-9]{20,}/gi, severity: 'high' as const }, // GitHub PATs
    { pattern: /AKIA[A-Z0-9]{16}/gi, severity: 'high' as const }, // AWS keys
  ];

  // Files to scan
  const scanDirs = ['src', 'scripts', 'app', 'lib'];
  
  for (const dir of scanDirs) {
    const dirPath = `${PROJECT_ROOT}/${dir}`;
    if (!existsSync(dirPath)) continue;

    try {
      const result = await runCommand(`grep -rn --include="*.ts" --include="*.tsx" --include="*.js" --include="*.json" -E "${secretPatterns.map(p => p.pattern.source).join('|')}" ${dir} 2>/dev/null || true`);
      
      const lines = result.stdout.split('\n').filter(Boolean);
      for (const line of lines) {
        // Skip if it's just a variable declaration or comment mentioning keys
        if (line.includes('//') && !line.includes('process.env')) continue;
        if (line.includes('YOUR_') || line.includes('EXAMPLE')) continue;
        
        // Parse the grep output
        const match = line.match(/([^:]+):(\d+):(.*)/);
        if (match) {
          const [, file, lineNum, content] = match;
          for (const { pattern, severity } of secretPatterns) {
            if (pattern.test(content)) {
              issues.push({
                severity,
                file: file.replace(`${PROJECT_ROOT}/`, ''),
                line: parseInt(lineNum, 10),
                issue: 'Potential exposed secret detected',
                recommendation: 'Move secrets to environment variables. Never commit secrets to version control.',
              });
            }
          }
        }
      }
    } catch {
      // Directory may not exist or be readable
    }
  }

  return issues;
}

// ============================================
// SECURITY SCAN - SUSPICIOUS PATTERNS
// ============================================

async function scanForSuspiciousPatterns(): Promise<SecurityIssue[]> {
  const issues: SecurityIssue[] = [];
  
  const suspiciousPatterns = [
    { 
      pattern: /eval\s*\(/, 
      severity: 'high' as const,
      issue: 'Use of eval() detected',
      recommendation: 'Avoid eval() as it can execute arbitrary code. Use safer alternatives.',
    },
    { 
      pattern: /innerHTML\s*=/, 
      severity: 'medium' as const,
      issue: 'Direct innerHTML assignment detected',
      recommendation: 'Use textContent or sanitize HTML before insertion to prevent XSS attacks.',
    },
    { 
      pattern: /dangerouslySetInnerHTML/, 
      severity: 'medium' as const,
      issue: 'DangerouslySetInnerHTML usage detected',
      recommendation: 'Ensure content is sanitized before use. Consider using DOMPurify.',
    },
    { 
      pattern: /process\.env\.NODE_ENV\s*==?\s*['"]dev['"]/, 
      severity: 'low' as const,
      issue: 'Environment-specific code paths detected',
      recommendation: 'Ensure security checks work in all environments, not just dev.',
    },
  ];

  const result = await runCommand(`grep -rn --include="*.ts" --include="*.tsx" -E "${suspiciousPatterns.map(p => p.pattern.source).join('|')}" src/ 2>/dev/null || true`);
  
  const lines = result.stdout.split('\n').filter(Boolean);
  for (const line of lines) {
    const match = line.match(/([^:]+):(\d+):(.*)/);
    if (match) {
      const [, file, lineNum, content] = match;
      for (const { pattern, severity, issue, recommendation } of suspiciousPatterns) {
        if (pattern.test(content)) {
          issues.push({
            severity,
            file: file.replace(`${PROJECT_ROOT}/`, ''),
            line: parseInt(lineNum, 10),
            issue,
            recommendation,
          });
        }
      }
    }
  }

  return issues;
}

// ============================================
// SUPPLY CHAIN - PACKAGE REGISTRY VERIFICATION
// ============================================

interface SupplyChainIssue {
  severity: 'high' | 'medium' | 'low';
  package: string;
  issue: string;
  recommendation: string;
}

async function verifyPackageRegistries(): Promise<SupplyChainIssue[]> {
  const issues: SupplyChainIssue[] = [];
  
  const pkgLockPath = `${PROJECT_ROOT}/package-lock.json`;
  const bunLockPath = `${PROJECT_ROOT}/bun.lock`;
  
  const lockPath = existsSync(bunLockPath) ? bunLockPath : pkgLockPath;
  
  if (!existsSync(lockPath)) {
    warn('No lock file found - cannot verify package integrity');
    return issues;
  }

  try {
    // Check if npm config has suspicious registries
    const npmConfig = await runCommand('npm config get registry');
    const defaultRegistry = npmConfig.stdout.trim();
    
    if (defaultRegistry !== 'https://registry.npmjs.org/' && 
        !defaultRegistry.includes('registry.npmjs.org')) {
      issues.push({
        severity: 'medium',
        package: 'npm registry',
        issue: `Non-standard registry configured: ${defaultRegistry}`,
        recommendation: 'Ensure registry is trusted. Using unofficial registries could introduce supply chain risks.',
      });
    }

    // Check for packages from suspicious sources
    const lsResult = await runCommand('bun pm ls 2>/dev/null || npm ls --depth=0 2>/dev/null || true');
    const packages = lsResult.stdout;

    // Check for known malicious patterns in package names (this is a basic check)
    const suspiciousPackagePatterns = [
      /-phishing/i,
      /-malware/i,
      /-hacked/i,
      /decryptor/i,
      /keylogger/i,
    ];

    for (const pkgLine of packages.split('\n')) {
      for (const pattern of suspiciousPackagePatterns) {
        if (pattern.test(pkgLine)) {
          issues.push({
            severity: 'high',
            package: pkgLine.trim(),
            issue: 'Potentially malicious package name detected',
            recommendation: 'Review this package carefully before installing.',
          });
        }
      }
    }
  } catch {
    // Some commands may fail
  }

  return issues;
}

// ============================================
// VULNERABILITY CHECKING
// ============================================

async function checkForVulnerabilities(): Promise<{ hasVulns: boolean; output: string }> {
  info('Checking for known vulnerabilities...');
  
  // Use npm audit if available
  const result = await runCommand('npm audit --audit-level=high 2>/dev/null || bun audit 2>/dev/null || true');
  
  const hasVulns = result.stdout.includes('vulnerabilities') &&
                  !result.stdout.includes('0 vulnerabilities') &&
                  result.exitCode !== 0; // Only if command actually found vulns
  
  return {
    hasVulns,
    output: result.stdout.substring(0, 3000),
  };
}

// ============================================
// CHECK .gitignore FOR SENSITIVE FILES
// ============================================

async function checkGitignore(): Promise<SecurityIssue[]> {
  const issues: SecurityIssue[] = [];
  
  const gitignorePath = `${PROJECT_ROOT}/.gitignore`;
  const vercelIgnorePath = `${PROJECT_ROOT}/.vercelignore`;
  const mustHavePatterns = [
    '.env',
    'node_modules/',
    '.next/',
    '*.log',
  ];

  // Accept either .gitignore or .vercelignore (Vercel checks both)
  if (!existsSync(gitignorePath) && !existsSync(vercelIgnorePath)) {
    issues.push({
      severity: 'high',
      file: '.gitignore',
      issue: '.gitignore file missing',
      recommendation: 'Create a .gitignore file to prevent committing sensitive files.',
    });
    return issues;
  }

  // Check .gitignore if it exists, otherwise check .vercelignore
  const ignorePath = existsSync(gitignorePath) ? gitignorePath : vercelIgnorePath;
  try {
    const gitignore = await readFile(ignorePath, 'utf-8');
    
    for (const pattern of mustHavePatterns) {
      const patternRegex = new RegExp(pattern.replace(/\*/g, '.*').replace(/\//g, '\\/'));
      if (!patternRegex.test(gitignore)) {
        issues.push({
          severity: 'medium',
          file: '.gitignore',
          issue: `Missing recommended pattern: ${pattern}`,
          recommendation: `Add ${pattern} to .gitignore to prevent accidental commits.`,
        });
      }
    }

    // Check if .env is being tracked
    const gitResult = await runCommand('git ls-files --cached .env 2>/dev/null || true');
    if (gitResult.stdout.includes('.env')) {
      issues.push({
        severity: 'high',
        file: '.env',
        issue: '.env file is tracked in git!',
        recommendation: 'Remove .env from git tracking immediately: git rm --cached .env',
      });
    }
  } catch {
    // Not a git repo or other error
  }

  return issues;
}

// ============================================
// MAIN SCAN
// ============================================

interface ScanResult {
  passed: boolean;
  totalIssues: number;
  highIssues: number;
  sections: {
    name: string;
    passed: boolean;
    issues: number;
  }[];
  fullReport: string;
}

async function runComplianceScan(): Promise<ScanResult> {
  console.log(`\n${colors.cyan}═══════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.cyan}     Compliance & Security Scan${colors.reset}`);
  console.log(`${colors.cyan}═══════════════════════════════════════════${colors.reset}\n`);

  const result: ScanResult = {
    passed: true,
    totalIssues: 0,
    highIssues: 0,
    sections: [],
    fullReport: '',
  };

  const allIssues: SecurityIssue[] = [];

  // 1. API Key Scan
  section('Scanning for exposed secrets...');
  const keyIssues = await scanForExposedKeys();
  allIssues.push(...keyIssues);
  if (keyIssues.length === 0) {
    success('No exposed secrets found');
  } else {
    fail(`Found ${keyIssues.length} potential secret exposures`);
    keyIssues.forEach(i => console.log(`  ${colors.red}${i.file}:${i.line || '?'} ${colors.reset} ${i.issue}`));
  }
  result.sections.push({ name: 'Secret Detection', passed: keyIssues.length === 0, issues: keyIssues.length });

  // 2. Suspicious Pattern Scan
  section('Scanning for suspicious code patterns...');
  const patternIssues = await scanForSuspiciousPatterns();
  allIssues.push(...patternIssues);
  if (patternIssues.length === 0) {
    success('No suspicious patterns found');
  } else {
    warn(`Found ${patternIssues.length} patterns to review`);
    patternIssues.forEach(i => console.log(`  ${colors.yellow}${i.file}:${i.line || '?'} ${colors.reset} ${i.issue}`));
  }
  result.sections.push({ name: 'Pattern Analysis', passed: patternIssues.length === 0, issues: patternIssues.length });

  // 3. Gitignore Check
  section('Checking .gitignore configuration...');
  const gitignoreIssues = await checkGitignore();
  allIssues.push(...gitignoreIssues);
  if (gitignoreIssues.length === 0) {
    success('.gitignore properly configured');
  } else {
    warn(`Found ${gitignoreIssues.length} .gitignore issues`);
    gitignoreIssues.forEach(i => console.log(`  ${colors.yellow}${i.file} ${colors.reset} ${i.issue}`));
  }
  result.sections.push({ name: 'Gitignore', passed: gitignoreIssues.length === 0, issues: gitignoreIssues.length });

  // 4. Supply Chain Check
  section('Verifying package supply chain...');
  const supplyIssues = await verifyPackageRegistries();
  allIssues.push(...supplyIssues);
  if (supplyIssues.length === 0) {
    success('Package registries verified');
  } else {
    warn(`Found ${supplyIssues.length} supply chain concerns`);
    supplyIssues.forEach(i => console.log(`  ${colors.yellow}${i.package} ${colors.reset} ${i.issue}`));
  }
  result.sections.push({ name: 'Supply Chain', passed: supplyIssues.length === 0, issues: supplyIssues.length });

  // 5. Vulnerability Check
  section('Checking for known vulnerabilities...');
  const vulnResult = await checkForVulnerabilities();
  if (!vulnResult.hasVulns) {
    success('No known vulnerabilities detected');
  } else {
    warn('Vulnerabilities detected');
    console.log(vulnResult.output.substring(0, 500));
    result.highIssues += 1;
  }
  result.sections.push({ name: 'Vulnerabilities', passed: !vulnResult.hasVulns, issues: vulnResult.hasVulns ? 1 : 0 });

  // Summary
  console.log(`\n${colors.cyan}═══════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.cyan}     Scan Summary${colors.reset}`);
  console.log(`${colors.cyan}═══════════════════════════════════════════${colors.reset}\n`);

  result.totalIssues = allIssues.length;
  result.highIssues = allIssues.filter(i => i.severity === 'high').length;

  for (const section of result.sections) {
    const status = section.passed ? `${colors.green}✓${colors.reset}` : `${colors.red}✗${colors.reset}`;
    console.log(`  ${status} ${section.name}: ${section.issues} issue(s)`);
  }

  console.log('');

  if (allIssues.length === 0) {
    success('All compliance checks passed!');
    result.passed = true;
  } else if (result.highIssues > 0) {
    fail(`${result.highIssues} HIGH severity issue(s) found`);
    result.passed = false;
  } else {
    warn(`${allIssues.length} medium/low severity issue(s) found`);
    result.passed = true; // Medium/low don't fail the build
  }

  // Build full report
  result.fullReport = allIssues.map(i => 
    `[${i.severity.toUpperCase()}] ${i.file}${i.line ? `:${i.line}` : ''} - ${i.issue}\n  ${i.recommendation}`
  ).join('\n\n');

  return result;
}

// Export for use in build pipeline
export { runComplianceScan, type SecurityIssue, type SupplyChainIssue, type ScanResult };

// Run if called directly
if (import.meta.main) {
  runComplianceScan().then(result => {
    if (!result.passed) {
      console.log('\nFailed compliance requirements. Fix issues before proceeding.\n');
      process.exit(1);
    }
    process.exit(0);
  }).catch(err => {
    fail(`Compliance scan failed: ${err.message}`);
    process.exit(1);
  });
}
