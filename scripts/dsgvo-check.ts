#!/usr/bin/env npx tsx
/**
 * DSGVO Compliance Check
 * @author andreas@siglochconsulting
 *
 * Verifies privacy-by-design implementation:
 * - GPS coordinates are rounded to 3 decimal places
 * - Broker personal data is filtered from responses
 * - sanitizeProperty function is used consistently
 */

import * as fs from 'fs';
import * as path from 'path';

interface CheckResult {
  passed: boolean;
  message: string;
  details?: string;
}

const checks: CheckResult[] = [];

function checkFile(filePath: string): void {
  if (!fs.existsSync(filePath)) {
    checks.push({
      passed: false,
      message: `File not found: ${filePath}`,
    });
    return;
  }

  const content = fs.readFileSync(filePath, 'utf-8');

  // Check 1: sanitizeProperty function exists
  const hasSanitizeFunction = /function sanitizeProperty\(/.test(content);
  checks.push({
    passed: hasSanitizeFunction,
    message: 'sanitizeProperty function exists',
    details: hasSanitizeFunction
      ? 'Found in src/index.ts'
      : 'Missing sanitizeProperty function in src/index.ts',
  });

  if (!hasSanitizeFunction) return;

  // Check 2: GPS rounding implementation
  const hasGpsRounding =
    /Math\.round\(.*lat\s*\*\s*1000\)\s*\/\s*1000/.test(content) &&
    /Math\.round\(.*lng\s*\*\s*1000\)\s*\/\s*1000/.test(content);
  checks.push({
    passed: hasGpsRounding,
    message: 'GPS coordinates rounded to 3 decimal places (~111m precision)',
    details: hasGpsRounding
      ? 'Math.round(lat * 1000) / 1000 implementation found'
      : 'GPS rounding implementation missing or incorrect',
  });

  // Check 3: Broker data removal
  const brokerFieldsRemoved =
    /delete\s+.*\.broker/.test(content) &&
    /delete\s+.*\.openimmo_email/.test(content) &&
    /delete\s+.*\.openimmo_firstname/.test(content) &&
    /delete\s+.*\.openimmo_lastname/.test(content) &&
    /delete\s+.*\.openimmo_phone/.test(content);
  checks.push({
    passed: brokerFieldsRemoved,
    message: 'Broker personal data fields removed',
    details: brokerFieldsRemoved
      ? 'All broker fields (broker, openimmo_*) are deleted'
      : 'Some broker fields may not be removed',
  });

  // Check 4: sanitizeProperty used in propstack_get_property
  const usedInGetProperty =
    /case\s+['"]propstack_get_property['"][\s\S]*?sanitizeProperty\(property/.test(
      content
    );
  checks.push({
    passed: usedInGetProperty,
    message: 'sanitizeProperty used in propstack_get_property tool',
    details: usedInGetProperty
      ? 'Tool applies sanitization'
      : 'Tool may not apply sanitization',
  });

  // Check 5: sanitizeProperty used in resources
  const usedInResources =
    /propstack:\/\/properties\/single[\s\S]*?sanitizeProperty\(property/.test(
      content
    );
  checks.push({
    passed: usedInResources,
    message: 'sanitizeProperty used in resource handlers',
    details: usedInResources
      ? 'Resources apply sanitization'
      : 'Resources may not apply sanitization',
  });

  // Check 6: Media fields optionally removed
  const hasMediaRemoval =
    /if\s*\(removeMedia\)[\s\S]*?delete\s+.*\.images/.test(content) &&
    /delete\s+.*\.documents/.test(content) &&
    /delete\s+.*\.videos/.test(content);
  checks.push({
    passed: hasMediaRemoval,
    message: 'Optional media field removal implemented',
    details: hasMediaRemoval
      ? 'Media fields (images, documents, videos) can be removed'
      : 'Media removal may not be implemented',
  });
}

function checkReadme(): void {
  const readmePath = path.join(process.cwd(), 'README.md');
  if (!fs.existsSync(readmePath)) {
    checks.push({
      passed: false,
      message: 'README.md not found',
    });
    return;
  }

  const content = fs.readFileSync(readmePath, 'utf-8');

  // Check if privacy section exists
  const hasPrivacySection =
    /DSGVO|Privacy|GPS.*round/i.test(content) &&
    /Broker.*contact.*data/i.test(content);
  checks.push({
    passed: hasPrivacySection,
    message: 'README documents privacy features',
    details: hasPrivacySection
      ? 'Privacy/DSGVO section found in README'
      : 'README should document privacy features',
  });
}

function printResults(): void {
  console.log('\n🔒 DSGVO Compliance Check\n');
  console.log('='.repeat(60));

  let passCount = 0;
  let failCount = 0;

  for (const check of checks) {
    const icon = check.passed ? '✅' : '❌';
    console.log(`\n${icon} ${check.message}`);
    if (check.details) {
      console.log(`   ${check.details}`);
    }

    if (check.passed) {
      passCount++;
    } else {
      failCount++;
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(`\nResults: ${passCount} passed, ${failCount} failed\n`);

  if (failCount > 0) {
    console.error('❌ DSGVO compliance check FAILED\n');
    process.exit(1);
  } else {
    console.log('✅ DSGVO compliance check PASSED\n');
    process.exit(0);
  }
}

function main(): void {
  const indexPath = path.join(process.cwd(), 'src/index.ts');
  checkFile(indexPath);
  checkReadme();
  printResults();
}

main();
