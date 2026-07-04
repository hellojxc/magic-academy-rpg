import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    port: 3000,
    open: true,
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (
            id.includes('/react/')
            || id.includes('/react-dom/')
            || id.includes('/scheduler/')
            || id.includes('/use-sync-external-store/')
          ) {
            return 'vendor-react';
          }
          if (id.includes('/three/')) return 'vendor-three';
          if (id.includes('/@react-three/fiber/')) return 'vendor-r3f-core';
          if (id.includes('/@react-three/drei/')) return 'vendor-drei';
          if (id.includes('/@dimforge/')) return 'vendor-rapier-core';
          if (id.includes('/@react-three/rapier/')) return 'vendor-rapier-react';
          if (id.includes('/ecctrl/')) return 'vendor-ecctrl';
          if (id.includes('/@react-three/postprocessing/') || id.includes('/postprocessing/')) return 'vendor-postprocessing';
          if (id.includes('/three-stdlib/')) return 'vendor-three-stdlib';
          if (id.includes('/@pmndrs/')) return 'vendor-r3f-core';
          if (id.includes('/@pixiv/three-vrm/')) return 'vendor-vrm';
          return undefined;
        },
      },
    },
  },
});
