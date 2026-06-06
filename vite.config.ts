// @ts-ignore
import tailwindcss from '@tailwindcss/vite';
// @ts-ignore
import react from '@vitejs/plugin-react';
import path from 'path';
// @ts-ignore
import { defineConfig } from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],

    resolve: {
      alias: {
        // @ts-ignore
        '@': path.resolve(__dirname, '.'),
      },
    },

    server: {
      // @ts-ignore
      hmr: process.env.DISABLE_HMR !== 'true',
      // @ts-ignore
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },

    build: {
      chunkSizeWarningLimit: 600,

      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (id.includes('lucide-react')) {
              return 'chunk-icons';
            }
            if (id.includes('node_modules/xlsx')) {
              return 'chunk-xlsx';
            }
            if (id.includes('html2canvas')) {
              return 'chunk-html2canvas';
            }
            if (id.includes('node_modules/motion') || id.includes('node_modules/framer-motion')) {
              return 'chunk-motion';
            }
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
            if (id.includes('node_modules')) {
              return 'chunk-vendor';
            }
          },
        },
      },
    },
  };
});
