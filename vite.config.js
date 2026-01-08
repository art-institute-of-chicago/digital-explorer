import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  assetsInclude: ['**/*.glb', '**/*.gltf'],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.js'), // Changed from App.jsx to index.js
      name: 'DigitalExplorer',
      fileName: 'digitalExplorer',
      formats: ['es', 'cjs']
    },
    rollupOptions: {
      // Externalize dependencies that shouldn't be bundled
      external: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        'three',
        '@react-three/fiber',
        '@react-three/drei',
        'gsap'
      ],
      output: {
        // Provide global variables for externalized deps (for UMD if needed)
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          'react/jsx-runtime': 'jsxRuntime',
          three: 'THREE',
          '@react-three/fiber': 'ReactThreeFiber',
          '@react-three/drei': 'ReactThreeDrei',
          gsap: 'gsap'
        },
        // Preserve CSS
        assetFileNames: (assetInfo) => {
          if (assetInfo.name === 'style.css') return 'digitalExplorer.css';
          return assetInfo.name;
        }
      }
    },
    // Ensure source maps for debugging
    sourcemap: true,
    // Output directory
    outDir: 'dist',
    // Clear output directory before build
    emptyOutDir: true
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src')
    }
  }
});