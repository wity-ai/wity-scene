import terser from '@rollup/plugin-terser';

export default [
  // Unminified ESM — for bundlers
  {
    input:    'index.js',
    external: ['@wity/scene-core'],
    output: {
      file:      'dist/scene-headless.esm.js',
      format:    'es',
      sourcemap: true,
    },
  },
  // Minified ESM — for CDN / direct browser use
  {
    input:    'index.js',
    external: ['@wity/scene-core'],
    output: {
      file:      'dist/scene-headless.esm.min.js',
      format:    'es',
      sourcemap: true,
      plugins:   [terser()],
    },
  },
];
