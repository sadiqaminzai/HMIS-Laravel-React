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

          const normalizedId = id.replace(/\\/g, '/');
          const inPackage = (pkg: string) => normalizedId.includes(`/node_modules/${pkg}/`);

          // MUI + emotion stack can be sizable and is shared across screens.
          if (
            normalizedId.includes('/node_modules/@mui/') ||
            normalizedId.includes('/node_modules/@emotion/') ||
            inPackage('@popperjs/core')
          ) {
            return 'vendor-mui';
          }

          // Radix UI primitives in a dedicated bundle.
          if (normalizedId.includes('/node_modules/@radix-ui/')) {
            return 'vendor-radix';
          }

          // Keep charting libs separate to avoid inflating generic chunks.
          if (inPackage('recharts')) return 'vendor-recharts';
          if (normalizedId.includes('/node_modules/d3-') || inPackage('internmap')) return 'vendor-d3';

          // i18n stack.
          if (
            inPackage('i18next') ||
            inPackage('react-i18next') ||
            inPackage('i18next-browser-languagedetector')
          ) {
            return 'vendor-i18n';
          }

          // Shared UI/utility libs.
          if (inPackage('lucide-react')) return 'vendor-icons';
          if (inPackage('axios')) return 'vendor-http';
          if (inPackage('date-fns')) return 'vendor-date';
          // Export and printing stack split to avoid one oversized chunk.
          if (inPackage('jspdf') || inPackage('jspdf-autotable')) return 'vendor-jspdf';
          if (inPackage('html2canvas') || inPackage('html-to-image')) return 'vendor-image-export';
          if (inPackage('xlsx')) return 'vendor-export-xlsx';

          // QR/barcode stack used by print flows.
          if (inPackage('qrcode') || inPackage('qrcode.react') || inPackage('react-barcode')) {
            return 'vendor-qr';
          }

          // Let Rollup place remaining dependencies automatically.
          return;
        },
      },
    },
  },
})
