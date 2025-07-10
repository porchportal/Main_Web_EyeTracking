/** @type {import('next').NextConfig} */
const nextConfig = {
    // Remove or modify this line if you don't want the /eye-tracking-app base path
    // basePath: '/eye-tracking-app',
    webpack: (config, { isServer }) => {
      // Disable minification temporarily
      if (!isServer) {
        config.optimization.minimize = false
      }
      return config
    },
    async rewrites() {
      return [
        {
          source: '/api/:path*',
          destination: 'http://backend:8000/api/:path*',
        },
      ]
    }
}

module.exports = nextConfig