import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],

    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },

    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },

    build: {
      // Raise warning threshold — we're splitting manually below
      chunkSizeWarningLimit: 600,

      rollupOptions: {
        output: {
          manualChunks(id: string) {
            // ── 1. lucide-react — icon tree-shaking is good but the full
            //        package is ~1.2MB unpacked; isolate it so it only
            //        re-downloads when icons change, not on every app change.
            if (id.includes('lucide-react')) {
              return 'chunk-icons';
            }

            // ── 2. xlsx — SheetJS is huge (~900KB). Ship once, cache forever.
            if (id.includes('node_modules/xlsx')) {
              return 'chunk-xlsx';
            }

            // ── 3. html2canvas — canvas renderer, rarely changes
            if (id.includes('html2canvas')) {
              return 'chunk-html2canvas';
            }

            // ── 4. motion (Framer Motion) — animation engine
            if (id.includes('node_modules/motion') || id.includes('node_modules/framer-motion')) {
              return 'chunk-motion';
            }

            // ── 5. React core + React-DOM — smallest possible main bundle
            if (id.includes('node_modules/react-dom')) {
              return 'chunk-react-dom';
            }
            if (
              id.includes('node_modules/react/') ||
              id.includes('node_modules/react-is') ||
              id.includes('node_modules/scheduler')
            ) {
              return 'chunk-react';
            }

            // ── 6. Everything else in node_modules → shared vendor chunk
            //       (catches express types stubs, dotenv shims, etc.)
            if (id.includes('node_modules')) {
              return 'chunk-vendor';
            }
            // App source files get bundled by Rollup's default entry-splitting
          },
        },
      },
    },
  };
});
