/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://auth_service:8108/api/:path*',
      },
      {
        source: '/health',
        destination: 'http://auth_service:8108/health',
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,OPTIONS,PATCH,DELETE,POST,PUT' },
          { key: 'Access-Control-Allow-Headers', value: 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version' },
        ],
      },
    ];
  },
  env: {
    NEXT_PUBLIC_BACKEND_URL: 'http://localhost:8108',
    NEXT_PUBLIC_API_URL: 'http://localhost:8108',
    BACKEND_URL: 'http://localhost:8108',
    NEXT_PUBLIC_API_KEY: 'A1B2C3D4-E5F6-7890-GHIJ-KLMNOPQRSTUV',
  },
  allowedDevOrigins: ['192.168.1.108'],
};

export default nextConfig; 