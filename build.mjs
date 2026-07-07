// build.mjs — esbuild configuration for prayer-times GNOME extension
// Bundles src/**.ts + adhan npm package → dist/
// All GI imports (gi://*) and GNOME Shell imports are marked external.

import * as esbuild from 'esbuild';
import { copyFileSync, mkdirSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const watch = process.argv.includes('--watch');

const DIST = join(__dirname, 'dist');
const SRC  = join(__dirname, 'src');

// Shared esbuild options
const sharedOpts = {
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  target: ['es2022'],
  minify: false,        // keep readable for EGO review
  sourcemap: false,
  external: [
    // All GNOME introspection namespaces
    'gi://*',
    // GNOME Shell resource imports
    'resource:///org/gnome/shell/*',
    'resource:///org/gnome/Shell/*',
  ],
};

// Entry points: each top-level src/*.ts becomes its own dist/*.js
// prefs.ts → dist/prefs.js  (loaded by GNOME prefs system)
// extension.ts → dist/extension.js
// adhan is bundled into extension.js only (prayer-manager imports it)

const entryPoints = [
  { in: join(SRC, 'extension.ts'),  out: join(DIST, 'extension') },
  { in: join(SRC, 'prefs.ts'),      out: join(DIST, 'prefs') },
];

async function build() {
  mkdirSync(DIST, { recursive: true });
  mkdirSync(join(DIST, 'sounds'), { recursive: true });

  // Copy static assets
  const soundsSrc = join(__dirname, 'sounds');
  if (existsSync(soundsSrc)) {
    for (const f of readdirSync(soundsSrc)) {
      copyFileSync(join(soundsSrc, f), join(DIST, 'sounds', f));
    }
  }

  // Copy metadata.json + schemas
  copyFileSync(join(__dirname, 'metadata.json'), join(DIST, 'metadata.json'));

  const schemasSrc = join(__dirname, 'schemas');
  const schemasDist = join(DIST, 'schemas');
  if (existsSync(schemasSrc)) {
    mkdirSync(schemasDist, { recursive: true });
    for (const f of readdirSync(schemasSrc)) {
      copyFileSync(join(schemasSrc, f), join(schemasDist, f));
    }
  }

  if (watch) {
    const ctxs = await Promise.all(
      entryPoints.map((ep) =>
        esbuild.context({ ...sharedOpts, entryPoints: [ep.in], outfile: ep.out + '.js' })
      )
    );
    await Promise.all(ctxs.map((ctx) => ctx.watch()));
    console.log('[build] watching for changes...');
  } else {
    await Promise.all(
      entryPoints.map((ep) =>
        esbuild.build({ ...sharedOpts, entryPoints: [ep.in], outfile: ep.out + '.js' })
      )
    );
    console.log('[build] done →', DIST);
  }
}

build().catch((e) => { console.error(e); process.exit(1); });