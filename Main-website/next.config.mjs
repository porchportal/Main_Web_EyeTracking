/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable strict mode for better development experience
  reactStrictMode: true,
  
  // Configure server options
  server: {
    // Allow all hostnames in development
    host: '0.0.0.0',
    // Use port 3000 by default
    port: 3000
  }
};

export default nextConfig;
