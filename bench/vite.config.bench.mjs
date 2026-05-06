import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import Vuetify from 'vite-plugin-vuetify'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  root: __dirname,
  define: {
    IS_ELECTRON: false,
    APP_VERSION: JSON.stringify('bench')
  },
  plugins: [vue(), Vuetify()],
  resolve: {
    alias: {
      '@renderer': resolve(__dirname, '../src/renderer/src')
    }
  },
  server: { port: 4175, strictPort: true }
})
