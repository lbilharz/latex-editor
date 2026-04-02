import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.js'),
      name: 'AccessibleMathEditor',
      fileName: 'accessible-math-editor',
      formats: ['es', 'umd']
    },
    rollupOptions: {
      // Ensure we don't bundle external dependencies like i18next unless we want to.
      // Since it's a UI component, bundling them might be easier, but externalizing is safer.
      // We will bundle it for simplicity of the drop-in replacement.
    }
  }
});
