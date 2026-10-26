import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  // Directs Vite to treat the 'public' folder as the frontend root
  root: 'public',
  
  build: {
    // Outputs the production build to a 'dist' folder in your project root
    outDir: '../dist',
    emptyOutDir: true,
    
    // If you have multiple HTML files, declare them here so Vite bundles them all
    rollupOptions: {
      input: {
        main: resolve(__dirname, '/index.html'),
        auth: resolve('./auth.html'),
        fixtures: resolve(__dirname,'./fixtures.html'),
        header:resolve(__dirname,'./header.html'),
        fixtures: resolve(__dirname,'./player.html')
      
        
      }
    }
  }
})
