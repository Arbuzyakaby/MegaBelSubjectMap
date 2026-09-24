import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base совпадает с именем репозитория для публикации на GitHub Pages
export default defineConfig({
  base: '/MegaBelSubjectMap/',
  plugins: [react()],
});
