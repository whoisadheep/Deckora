/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ['local.loca.lt', 'loca.lt'],
  experimental: {
    proxyTimeout: 120000,
  },
  async rewrites() {
    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`, // Proxy to backend dynamically
      },
    ]
  },
};

export default nextConfig;
