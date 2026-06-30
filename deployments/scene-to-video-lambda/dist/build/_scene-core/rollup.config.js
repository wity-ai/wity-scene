import terser from '@rollup/plugin-terser';

export default [
  // Unminified ESM — for bundlers (Vite, webpack, rollup)
  {
    input: 'index.js',
    output: {
      file:      'dist/scene-core.esm.js',
      format:    'es',
      sourcemap: true,
    },
  },
  // Minified ESM — for CDN / direct browser use
  {
    input: 'index.js',
    output: {
      file:      'dist/scene-core.esm.min.js',
      format:    'es',
      sourcemap: true,
      plugins:   [terser()],
    },
  },
];
