/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable strict mode for better development experience
  reactStrictMode: true,
  
  // Remove experimental features that cause issues
  experimental: {
    // Remove problematic optimisticClientCache
  },
  
  // Add proper configuration for Docker development
  output: 'standalone',
  
  // Image configuration for Next.js 16 compatibility
  images: {
    qualities: [25, 50, 75, 100],
    formats: ['image/webp', 'image/avif'],
  },
  
  // Webpack configuration for HMR
  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) {
      // Configure HMR for HTTPS
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
      };
    }
    return config;
  },
  
  // Environment variables for backend configuration
  env: {
    BACKEND_URL: process.env.BACKEND_URL || 'http://backend_auth_service:8108',
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'https://172.18.20.184',
    NEXT_PUBLIC_API_KEY: process.env.NEXT_PUBLIC_API_KEY || 'A1B2C3D4-E5F6-7890-GHIJ-KLMNOPQRSTUV',
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL || 'wss://172.18.20.184/ws'
  }
};

export default nextConfig;
