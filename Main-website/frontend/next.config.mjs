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
  
  // Environment variables for backend configuration
  env: {
    BACKEND_URL: process.env.BACKEND_URL,
    NEXT_PUBLIC_API_KEY: process.env.NEXT_PUBLIC_API_KEY,
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL
  }
};

export default nextConfig;
