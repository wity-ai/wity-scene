export default {
  input:    'index.js',
  external: ['@wity/scene-core'],
  output: {
    file:      'dist/scene-headless.esm.js',
    format:    'es',
    sourcemap: true,
  },
};
