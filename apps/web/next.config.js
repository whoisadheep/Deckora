/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ['local.loca.lt', 'loca.lt'],
  experimental: {
    proxyTimeout: 120000,
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:3001/api/:path*', // Proxy to backend
      },
    ]
  },
};

export default nextConfig;
