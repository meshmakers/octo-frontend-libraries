#!/usr/bin/env node
/**
 * Telerik/Kendo UI License Setup Script
 *
 * This script checks for the TELERIK_LICENSE environment variable, creates
 * the license file, and activates it using the Kendo licensing tool.
 *
 * Usage:
 *   node scripts/setup-license.js
 *
 * Environment Variables:
 *   TELERIK_LICENSE - The Telerik/Kendo UI license key (required)
 *
 * Exit Codes:
 *   0 - Success
 *   1 - TELERIK_LICENSE environment variable not set or activation failed
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const LICENSE_ENV_VAR = 'TELERIK_LICENSE';
const LICENSE_FILE_NAME = 'kendo-ui-license.txt';

function main() {
  const license = process.env[LICENSE_ENV_VAR];

  if (!license) {
    console.error('\x1b[31m%s\x1b[0m', '╔════════════════════════════════════════════════════════════════╗');
    console.error('\x1b[31m%s\x1b[0m', '║  ERROR: TELERIK_LICENSE environment variable is not set!       ║');
    console.error('\x1b[31m%s\x1b[0m', '╠════════════════════════════════════════════════════════════════╣');
    console.error('\x1b[31m%s\x1b[0m', '║  To fix this:                                                  ║');
    console.error('\x1b[31m%s\x1b[0m', '║  1. Download your license from:                                ║');
    console.error('\x1b[31m%s\x1b[0m', '║     https://www.telerik.com/account/your-products              ║');
    console.error('\x1b[31m%s\x1b[0m', '║  2. Set the environment variable:                              ║');
    console.error('\x1b[31m%s\x1b[0m', '║     export TELERIK_LICENSE="<your-license-key>"                ║');
    console.error('\x1b[31m%s\x1b[0m', '║  3. Add it to your shell profile (~/.zshrc or ~/.bashrc)       ║');
    console.error('\x1b[31m%s\x1b[0m', '╚════════════════════════════════════════════════════════════════╝');
    process.exit(1);
  }

  // Write the license file
  const projectRoot = path.join(__dirname, '..');
  const licenseFilePath = path.join(projectRoot, LICENSE_FILE_NAME);

  try {
    fs.writeFileSync(licenseFilePath, license + '\n', 'utf8');
    console.log('\x1b[32m%s\x1b[0m', `✓ Telerik license file created: ${LICENSE_FILE_NAME}`);
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', `✗ Failed to write license file: ${error.message}`);
    process.exit(1);
  }

  // Activate the license
  try {
    console.log('\x1b[36m%s\x1b[0m', '→ Activating Kendo UI license...');
    execSync('npx kendo-ui-license activate', {
      cwd: projectRoot,
      stdio: 'inherit',
      env: { ...process.env, TELERIK_LICENSE: license }
    });
    console.log('\x1b[32m%s\x1b[0m', '✓ Kendo UI license activated');
  } catch (error) {
    console.error('\x1b[31m%s\x1b[0m', '✗ Failed to activate license. Build will continue but license warnings may appear.');
    // Don't exit with error - let the build continue
  }
}

main();
