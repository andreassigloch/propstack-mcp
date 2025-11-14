#!/usr/bin/env npx tsx
/**
 * Secrets Scanner
 * @author andreas@siglochconsulting
 *
 * Scans codebase for accidentally committed secrets:
 * - API keys
 * - Tokens
 * - Passwords
 * - Email addresses in code
 * - Hardcoded credentials
 */

import * as fs from 'fs';
import * as path from 'path';

interface SecretMatch {
  file: string;
  line: number;
  pattern: string;
  match: string;
  severity: 'high' | 'medium' | 'low';
}

const secretsFound: SecretMatch[] = [];

// Patterns to detect secrets
const SECRET_PATTERNS = [
  {
    name: 'PropStack API Key',
    regex: /[a-zA-Z0-9]{32,64}:[a-zA-Z0-9_-]{20,}/g,
    severity: 'high' as const,
  },
  {
    name: 'Generic API Key',
    regex: /api[_-]?key\s*[:=]\s*['"][a-zA-Z0-9_-]{20,}['"]/gi,
    severity: 'high' as const,
  },
  {
    name: 'Bearer Token',
    regex: /bearer\s+[a-zA-Z0-9_-]{20,}/gi,
    severity: 'high' as const,
  },
  {
    name: 'Password in Code',
    regex: /password\s*[:=]\s*['"][^'"]+['"]/gi,
    severity: 'high' as const,
  },
  {
    name: 'Email in Code',
    regex: /[a-zA-Z0-9._%+-]+@(?!example\.com|test\.com|localhost)[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    severity: 'medium' as const,
  },
  {
    name: 'AWS Key',
    regex: /AKIA[0-9A-Z]{16}/g,
    severity: 'high' as const,
  },
  {
    name: 'Private Key',
    regex: /-----BEGIN\s+(RSA\s+)?PRIVATE KEY-----/g,
    severity: 'high' as const,
  },
];

// Files/directories to ignore
const IGNORE_PATTERNS = [
  'node_modules',
  '.git',
  'dist',
  '.mcpb',
  '*.log',
  '*.map',
  'package-lock.json',
  '.DS_Store',
  'scripts/secrets-check.ts', // Ignore self
  'scripts/dsgvo-check.ts',
];

// Allowed patterns (false positives)
const ALLOWED_PATTERNS = [
  /process\.env\.PROPSTACK_API_KEY/, // Environment variable usage
  /PROPSTACK_API_KEY.*environment variable/, // Documentation
  /your-api-key-here/, // Placeholder
  /\$\{.*API.*\}/, // Variable substitution
  /@siglochconsulting/, // Company email
  /andreas@siglochconsulting/, // Author email
  /noreply@anthropic\.com/, // Co-author
  /regina@sigloch-immobilien\.de/, // Example from API response
];

function shouldIgnore(filePath: string): boolean {
  for (const pattern of IGNORE_PATTERNS) {
    if (filePath.includes(pattern.replace('*', ''))) {
      return true;
    }
  }
  return false;
}

function isAllowedMatch(match: string, context: string): boolean {
  for (const pattern of ALLOWED_PATTERNS) {
    if (pattern.test(context)) {
      return true;
    }
  }
  return false;
}

function scanFile(filePath: string): void {
  if (shouldIgnore(filePath)) return;

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');

    for (const pattern of SECRET_PATTERNS) {
      for (let lineNum = 0; lineNum < lines.length; lineNum++) {
        const line = lines[lineNum];
        const matches = line.match(pattern.regex);

        if (matches) {
          for (const match of matches) {
            // Get context (3 lines before and after)
            const contextStart = Math.max(0, lineNum - 3);
            const contextEnd = Math.min(lines.length, lineNum + 4);
            const context = lines.slice(contextStart, contextEnd).join('\n');

            if (!isAllowedMatch(match, context)) {
              secretsFound.push({
                file: filePath,
                line: lineNum + 1,
                pattern: pattern.name,
                match: match.length > 50 ? match.substring(0, 47) + '...' : match,
                severity: pattern.severity,
              });
            }
          }
        }
      }
    }
  } catch (error) {
    // Skip binary files or unreadable files
    if (error instanceof Error && !error.message.includes('EISDIR')) {
      console.warn(`Warning: Could not scan ${filePath}: ${error.message}`);
    }
  }
}

function scanDirectory(dir: string): void {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (shouldIgnore(fullPath)) continue;

      if (entry.isDirectory()) {
        scanDirectory(fullPath);
      } else if (entry.isFile()) {
        scanFile(fullPath);
      }
    }
  } catch (error) {
    console.warn(`Warning: Could not scan directory ${dir}`);
  }
}

function checkGitignore(): void {
  const gitignorePath = path.join(process.cwd(), '.gitignore');

  if (!fs.existsSync(gitignorePath)) {
    secretsFound.push({
      file: '.gitignore',
      line: 0,
      pattern: 'Missing .gitignore',
      match: '.gitignore file not found',
      severity: 'high',
    });
    return;
  }

  const content = fs.readFileSync(gitignorePath, 'utf-8');

  // Check for required entries
  const requiredEntries = [
    '.env',
    '.mcp.json',
    'inspector-config.json',
    '.claude/',
  ];

  for (const entry of requiredEntries) {
    if (!content.includes(entry)) {
      secretsFound.push({
        file: '.gitignore',
        line: 0,
        pattern: 'Missing .gitignore entry',
        match: `${entry} should be in .gitignore`,
        severity: 'high',
      });
    }
  }
}

function printResults(): void {
  console.log('\n🔐 Secrets Scanner\n');
  console.log('='.repeat(60));

  if (secretsFound.length === 0) {
    console.log('\n✅ No secrets found\n');
    console.log('='.repeat(60));
    console.log('\n✅ Secrets check PASSED\n');
    process.exit(0);
  }

  // Group by severity
  const high = secretsFound.filter(s => s.severity === 'high');
  const medium = secretsFound.filter(s => s.severity === 'medium');
  const low = secretsFound.filter(s => s.severity === 'low');

  if (high.length > 0) {
    console.log('\n🚨 HIGH SEVERITY:\n');
    for (const secret of high) {
      console.log(`  ${secret.file}:${secret.line}`);
      console.log(`  Pattern: ${secret.pattern}`);
      console.log(`  Match: ${secret.match}`);
      console.log('');
    }
  }

  if (medium.length > 0) {
    console.log('\n⚠️  MEDIUM SEVERITY:\n');
    for (const secret of medium) {
      console.log(`  ${secret.file}:${secret.line}`);
      console.log(`  Pattern: ${secret.pattern}`);
      console.log(`  Match: ${secret.match}`);
      console.log('');
    }
  }

  if (low.length > 0) {
    console.log('\n📝 LOW SEVERITY:\n');
    for (const secret of low) {
      console.log(`  ${secret.file}:${secret.line}`);
      console.log(`  Pattern: ${secret.pattern}`);
      console.log(`  Match: ${secret.match}`);
      console.log('');
    }
  }

  console.log('='.repeat(60));
  console.log(
    `\nFound: ${high.length} high, ${medium.length} medium, ${low.length} low\n`
  );

  if (high.length > 0) {
    console.error('❌ Secrets check FAILED - High severity issues found\n');
    process.exit(1);
  } else if (medium.length > 0) {
    console.warn('⚠️  Secrets check WARNING - Review medium severity issues\n');
    process.exit(0); // Don't fail on medium severity
  } else {
    console.log('✅ Secrets check PASSED\n');
    process.exit(0);
  }
}

function main(): void {
  checkGitignore();
  scanDirectory(process.cwd());
  printResults();
}

main();
