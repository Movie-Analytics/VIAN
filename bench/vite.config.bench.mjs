import { dirname, resolve } from 'path'
import { defineConfig } from 'vite'
import { fileURLToPath } from 'url'
import vue from '@vitejs/plugin-vue'
import vuetifyPlugin from 'vite-plugin-vuetify'

const dir = dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  define: {
    APP_VERSION: JSON.stringify('bench'),
    IS_ELECTRON: false
  },
  plugins: [vue(), vuetifyPlugin()],
  resolve: {
    alias: {
      '@renderer': resolve(dir, '../src/renderer/src')
    }
  },
  root: dir,
  server: { port: 4175, strictPort: true }
})
