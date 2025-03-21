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
  }
  
  module.exports = nextConfig