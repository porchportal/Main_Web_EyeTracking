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
  
  // Disable source maps completely (both dev and production)
  productionBrowserSourceMaps: false,

  // Disable generate source maps during development too
  generateBuildId: async () => {
    // Use a random ID to make it harder to track builds
    return Math.random().toString(36).substring(7);
  },

  // Webpack configuration - DISABLE ALL SOURCE MAPS (console will work normally)
  webpack: (config, { dev, isServer }) => {
    // ALWAYS disable source maps (both dev and production)
    config.devtool = false;

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

    // Apply aggressive minification and obfuscation to BOTH dev and production
    config.optimization = {
      ...config.optimization,
      minimize: true,
    };

    // Configure existing Terser minimizer (Next.js has it built-in)
    if (config.optimization.minimizer) {
      config.optimization.minimizer.forEach((minimizer) => {
        if (minimizer.constructor.name === 'TerserPlugin') {
          minimizer.options.terserOptions = {
            ...minimizer.options.terserOptions,
            compress: {
              ...minimizer.options.terserOptions.compress,
              drop_console: false, // Keep console working
              drop_debugger: true,
              passes: 3,
            },
            mangle: {
              toplevel: true,
              safari10: true,
            },
            output: {
              comments: false,
              ascii_only: true,
            },
            keep_classnames: false,
            keep_fnames: false,
          };
          minimizer.options.extractComments = false;
        }
      });
    }

    // Remove source map related plugins
    config.plugins = config.plugins.filter(plugin => {
      return plugin.constructor.name !== 'SourceMapDevToolPlugin';
    });

    // Disable file names in output
    if (!isServer) {
      config.output.pathinfo = false;
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
