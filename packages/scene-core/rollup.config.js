export default {
  input: 'index.js',
  output: {
    file:      'dist/scene-core.esm.js',
    format:    'es',
    sourcemap: true,
  },
  // @xmldom/xmldom is loaded via runtime require() shim — not a static import,
  // so rollup never sees it. No external declarations needed.
};
