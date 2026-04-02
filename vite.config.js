import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig(({ mode }) => {
  if (process.env.BUILD_DEMO) {
    return {
      build: {
        outDir: 'dist-demo',
      }
    };
  }

  return {
    build: {
      lib: {
        entry: resolve(__dirname, 'src/index.js'),
        name: 'AccessibleMathEditor',
        fileName: 'accessible-math-editor',
        formats: ['es', 'umd']
      }
    }
  };
});
