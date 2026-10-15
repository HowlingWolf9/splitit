import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    watch: {
      ignored: ['**/android/**', '**/artifacts/**', '**/release/**', '**/src-tauri/target/**', '**/*.keystore', '**/*.aab', '**/*.apk']
    }
  }
})
