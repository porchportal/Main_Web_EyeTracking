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
  
  // Configure allowed development origins from environment variables
  allowedDevOrigins: process.env.ALLOWED_DEV_ORIGINS ? 
    process.env.ALLOWED_DEV_ORIGINS.split(',').map(origin => origin.trim()) : 
    [],
  
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
    BACKEND_URL: process.env.BACKEND_URL,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_API_KEY: process.env.NEXT_PUBLIC_API_KEY,
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL
  }
};

export default nextConfig;
