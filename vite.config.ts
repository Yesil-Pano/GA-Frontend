import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000, // Portu 3000 olarak zorluyoruz
    strictPort: true, // Eğer 3000 de doluysa hata versin, başka porta geçmesin
    host: 'localhost' // Sadece localhost üzerinden dinlesin (IPv6 ::1 çakışmasını engeller)
  }
})