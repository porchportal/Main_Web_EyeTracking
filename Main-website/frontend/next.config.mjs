/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable strict mode for better development experience
  reactStrictMode: true,
  
  // Improve webpack configuration for hot reload
  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) {
      // Improve hot reload reliability
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
      };
      
      // Handle webpack hot update errors more gracefully
      config.optimization = {
        ...config.optimization,
        moduleIds: 'named',
      };
    }
    
    return config;
  },
  
  // Experimental features for better development experience
  experimental: {
    // Improve Fast Refresh behavior
    optimizeCss: false,
    optimisticClientCache: false,
  },
};

export default nextConfig;
