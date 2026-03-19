import resolve from '@rollup/plugin-node-resolve';

export default {
  input: 'src/index.js',
  output: {
    file: 'dist/lampa-iptv.js',
    format: 'iife',
    name: 'LampaIPTV',
    banner: '/* Lampa IPTV Plugin v0.1.0 */'
  },
  plugins: [resolve()]
};
