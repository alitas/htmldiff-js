import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  dts: true,
  target: ['es6'],
  format: ['cjs', 'esm'],
  clean: true,
});
