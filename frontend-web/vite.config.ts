import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/HMIS/',
  plugins: [
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: [
      // Alias @ to the src directory
      { find: '@', replacement: '/src' },
    ],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;

          // Keep charting libs in their own async chunk.
          if (id.includes('recharts') || id.includes('/d3-')) return 'vendor-charts';
          // i18n stack is used across routes but can live outside the app entry chunk.
          if (id.includes('i18next') || id.includes('react-i18next')) return 'vendor-i18n';
          // Icon package is sizable and safe to isolate.
          if (id.includes('lucide-react')) return 'vendor-icons';
          // Shared HTTP/client utility libs.
          if (id.includes('axios')) return 'vendor-http';

          if (id.includes('jspdf') || id.includes('html2canvas')) return 'vendor-export-pdf';
          if (id.includes('xlsx')) return 'vendor-export-xlsx';
          if (id.includes('date-fns')) return 'vendor-date';
        },
      },
    },
  },
})
