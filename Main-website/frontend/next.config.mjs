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
};

export default nextConfig;
