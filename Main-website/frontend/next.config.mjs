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
  
  // Disable telemetry
  telemetry: false,
  
  // Environment variables for backend configuration
  env: {
    BACKEND_URL: process.env.BACKEND_URL || 'http://localhost:8108',
    NEXT_PUBLIC_API_KEY: process.env.NEXT_PUBLIC_API_KEY || 'A1B2C3D4-E5F6-7890-GHIJ-KLMNOPQRSTUV',
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8108'
  }
};

export default nextConfig;
