/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable strict mode for better development experience
  reactStrictMode: true,
  
  // Improve webpack configuration for hot reload
  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) {
      // Optimize for Docker development environment
      config.watchOptions = {
        poll: 3000,
        aggregateTimeout: 1000,
        ignored: ['**/node_modules', '**/.git', '**/.next', '**/dist'],
      };
      
      // Improve hot module replacement
      config.optimization = {
        ...config.optimization,
        moduleIds: 'named',
        chunkIds: 'named',
      };
      
      // Better handling of hot updates with correct hash naming
      config.output = {
        ...config.output,
        hotUpdateChunkFilename: '.hot/[id].[fullhash].hot-update.js',
        hotUpdateMainFilename: '.hot/[fullhash].hot-update.json',
      };
    }
    
    return config;
  },
  
  // Remove experimental features that cause issues
  experimental: {
    // Remove problematic optimisticClientCache
  },
  
  // Add proper configuration for Docker development
  output: 'standalone',
};

export default nextConfig;
