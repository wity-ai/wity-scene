/**
 * @file test/smoke.js
 * End-to-end smoke test for @wity/scene-compiler.
 *
 * Compiles a minimal scene covering all three element types
 * (ws-rect, ws-image, ws-text) and verifies the output MP4 exists
 * with non-zero size.
 *
 * Run:  node packages/scene-compiler/test/smoke.js
 *
 * Exits 0 on pass, 1 on failure.
 * No test framework — plain Node.js assertions.
 */

import { compile } from '../index.js';
import { stat }    from 'fs/promises';

// ─── Minimal scene: 1 second, all 3 element types ────────────────────────────

const SCENE_XML = `
<wity-scene version="1.0" width="640" height="360" dur="1.0">

  <ws-layer id="background" z="0">
    <ws-rect
      id="bg"
      x="0" y="0"
      width="640" height="360"
      fill="#1a1a2e"
      begin="0" dur="1"
    />
  </ws-layer>

  <ws-layer id="media" z="5">
    <ws-image
      id="img"
      x="0" y="0"
      width="640" height="360"
      src="https://picsum.photos/seed/wity/640/360"
      fit="cover"
      begin="0" dur="1"
    />
  </ws-layer>

  <ws-layer id="overlay" z="10">
    <ws-text
      id="label"
      x="50%" y="50%"
      anchor="center"
      font-size="48"
      font-family="sans-serif"
      color="#ffffff"
      text-align="center"
      animate-in="fade-up"
      animate-dur="0.4"
      begin="0" dur="1"
    >smoke test</ws-text>
  </ws-layer>

</wity-scene>
`.trim();

// ─── Helpers ──────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ✓  ${label}`);
    passed++;
  } else {
    console.error(`  ✗  ${label}`);
    failed++;
  }
}

// ─── Run ──────────────────────────────────────────────────────────────────────

console.log('\n@wity/scene-compiler smoke test\n');

let cleanup;
try {
  console.log('  Compiling 1s scene at 30fps (ws-rect + ws-image + ws-text)...');
  const start  = Date.now();
  const result = await compile(SCENE_XML, {}, { fps: 30 });
  const ms     = Date.now() - start;
  cleanup      = result.cleanup;

  console.log(`  Compile time: ${ms}ms\n`);

  // 1. Output path is a string
  assert(typeof result.videoPath === 'string', 'videoPath is a string');

  // 2. Output file exists
  let fileStat;
  try {
    fileStat = await stat(result.videoPath);
    assert(true, 'output file exists on disk');
  } catch {
    assert(false, 'output file exists on disk');
  }

  // 3. Output file has non-zero size
  if (fileStat) {
    assert(fileStat.size > 0, `output file has non-zero size (${fileStat.size} bytes)`);
  }

  // 4. cleanup is a function
  assert(typeof result.cleanup === 'function', 'cleanup is a function');

  // 5. cleanup runs without error
  try {
    await cleanup();
    cleanup = null;
    assert(true, 'cleanup() resolves without error');
  } catch (e) {
    assert(false, `cleanup() resolves without error — ${e.message}`);
  }

} catch (e) {
  console.error('\n  FATAL: compile() threw unexpectedly:\n ', e.message);
  console.error(e.stack);
  failed++;
  if (cleanup) await cleanup().catch(() => {});
}

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log(`\n  ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
