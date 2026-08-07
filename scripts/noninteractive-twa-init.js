/**
 * Non-interactive Bubblewrap TWA project generator.
 * Uses @bubblewrap/core + CLI helpers without Inquirer prompts.
 *
 * Usage (from repo root):
 *   node scripts/noninteractive-twa-init.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const MANIFEST_URL =
  'https://bryanralston.github.io/schedule-builder/manifest.webmanifest';
const TARGET_DIR = path.resolve(__dirname, '..', 'android-twa');
const SECRETS_DIR = path.join(os.homedir(), '..', 'bryma', 'schedule-builder-secrets');
// Prefer absolute path Bryan uses:
const SECRETS = process.env.MSB_SECRETS || 'C:\\Users\\bryma\\schedule-builder-secrets';
const KEYSTORE = path.join(SECRETS, 'android.keystore');
const KEY_ALIAS = 'schedule-pro';

const PACKAGE_ID = 'com.managerschedulebuilder.pro';
const APP_NAME = 'Manager Schedule Builder Pro';
const LAUNCHER_NAME = 'Schedule Pro';

class AutoPrompt {
  constructor(answers = {}) {
    this.answers = answers;
    this._confirmQueue = answers.confirms || [];
  }
  async printMessage(msg) {
    console.log(msg);
  }
  async promptInput(message, defaultValue, validateFunction) {
    const v = defaultValue != null && defaultValue !== '' ? defaultValue : '';
    if (validateFunction) {
      const r = await validateFunction(v);
      if (r && typeof r.isOk === 'function' && !r.isOk()) {
        throw new Error(`Validation failed for "${message}": ${v}`);
      }
      if (r && typeof r.unwrap === 'function') return r.unwrap();
    }
    return v;
  }
  async promptChoice(message, choices, defaultValue, validateFunction) {
    return this.promptInput(message, defaultValue, validateFunction);
  }
  async promptConfirm(message, defaultValue) {
    if (this._confirmQueue.length) return this._confirmQueue.shift();
    return defaultValue;
  }
  async promptPassword(message, validateFunction) {
    throw new Error(`Unexpected password prompt: ${message}`);
  }
  async downloadFile(url, filename, totalSize = 0) {
    // Reuse core fetch
    const { fetchUtils } = require('@bubblewrap/core');
    await fetchUtils.downloadFile(url, filename, () => {});
  }
}

async function main() {
  // Resolve bubblewrap modules from global install
  const bwCliRoot = path.dirname(
    require.resolve('@bubblewrap/cli/package.json', {
      paths: [
        path.join(process.env.APPDATA || '', 'npm', 'node_modules'),
        path.join(process.env.APPDATA || '', 'npm', 'node_modules', '@bubblewrap', 'cli'),
      ],
    })
  );
  // When running via node and bubblewrap is global:
  let core;
  let shared;
  let Config;
  try {
    core = require('@bubblewrap/core');
  } catch {
    core = require(path.join(
      process.env.APPDATA,
      'npm',
      'node_modules',
      '@bubblewrap',
      'cli',
      'node_modules',
      '@bubblewrap',
      'core'
    ));
  }
  try {
    shared = require(path.join(
      process.env.APPDATA,
      'npm',
      'node_modules',
      '@bubblewrap',
      'cli',
      'dist',
      'lib',
      'cmds',
      'shared'
    ));
  } catch (e) {
    console.error('Could not load bubblewrap shared helpers', e);
    process.exit(1);
  }

  if (!fs.existsSync(KEYSTORE)) {
    console.error('Missing keystore at', KEYSTORE);
    process.exit(1);
  }

  fs.mkdirSync(TARGET_DIR, { recursive: true });

  console.log('Fetching web manifest:', MANIFEST_URL);
  let twaManifest = await core.TwaManifest.fromWebManifest(MANIFEST_URL);

  // Override product identity
  twaManifest.packageId = PACKAGE_ID;
  twaManifest.name = APP_NAME;
  twaManifest.launcherName = LAUNCHER_NAME;
  twaManifest.appVersionName = '2.1.0';
  twaManifest.appVersionCode = 210;
  // host/startUrl should already be project-page aware from relative manifest
  console.log('host=', twaManifest.host);
  console.log('startUrl=', twaManifest.startUrl);
  console.log('iconUrl=', twaManifest.iconUrl);
  console.log('maskableIconUrl=', twaManifest.maskableIconUrl);

  twaManifest.signingKey = {
    path: KEYSTORE,
    alias: KEY_ALIAS,
  };
  twaManifest.generatorApp = 'bubblewrap-cli';

  // Drop shortcuts if icon fetch might fail nested — keep them (from manifest)
  // Disable optional features
  twaManifest.features = {};

  const prompt = new AutoPrompt({
    confirms: [false, false, false], // shortcuts keep default true handled separately
  });

  // Keep shortcuts from web manifest (default)
  const manifestPath = path.join(TARGET_DIR, 'twa-manifest.json');
  await twaManifest.saveToFile(manifestPath);
  console.log('Wrote', manifestPath);

  const twaGenerator = new core.TwaGenerator();
  await shared.generateTwaProject(prompt, twaGenerator, TARGET_DIR, twaManifest);
  await shared.generateManifestChecksumFile(manifestPath, TARGET_DIR);

  console.log('TWA project generated at', TARGET_DIR);
  console.log('Next: bubblewrap build from that directory (with password flags or interactive).');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
