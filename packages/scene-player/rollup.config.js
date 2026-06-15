import terser from '@rollup/plugin-terser';

export default [
  // Unminified ESM — for bundlers
  {
    input:    'index.js',
    external: ['@wity/scene-core', '@wity/scene-headless'],
    output: {
      file:      'dist/scene-player.esm.js',
      format:    'es',
      sourcemap: true,
    },
  },
  // Minified ESM — for CDN / direct browser use
  {
    input:    'index.js',
    external: ['@wity/scene-core', '@wity/scene-headless'],
    output: {
      file:      'dist/scene-player.esm.min.js',
      format:    'es',
      sourcemap: true,
      plugins:   [terser()],
    },
  },
];
