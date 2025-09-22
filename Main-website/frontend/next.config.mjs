/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable strict mode for better development experience
  reactStrictMode: true,
  
  // Disable development indicators (Next.js badge)
  devIndicators: false,
  
  // Add proper configuration for Docker development
  output: 'standalone',
  
  // Note: Development origin restrictions should be handled at the server level or through middleware
  
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
      
      // Disable Next.js development tools badge
      config.plugins = config.plugins.filter(plugin => {
        return plugin.constructor.name !== 'NextJsDevToolsPlugin';
      });
    }
    return config;
  },
  
  // Note: devServer configuration is not valid in Next.js config
  // Development server settings should be configured via command line flags or environment variables
  
  // Headers configuration for CORS
  async headers() {
    return [
      {
        source: '/_next/:path*',
        headers: [
          {
            key: 'Access-Control-Allow-Origin',
            value: '*',
          },
          {
            key: 'Access-Control-Allow-Methods',
            value: 'GET, POST, PUT, DELETE, OPTIONS',
          },
          {
            key: 'Access-Control-Allow-Headers',
            value: 'Content-Type, Authorization',
          },
        ],
      },
    ];
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
