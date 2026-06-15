export default {
  input:    'index.js',
  external: ['@wity/scene-core', '@wity/scene-headless'],
  output: {
    file:      'dist/scene-player.esm.js',
    format:    'es',
    sourcemap: true,
  },
};
