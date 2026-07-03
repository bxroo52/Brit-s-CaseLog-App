/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Completely disable Next.js dev indicators (floating panel)
  devIndicators: false,

  // Force fresh HTML on every request (no aggressive caching on pages)
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, must-revalidate', // HTML always revalidates
          },
        ],
      },
      {
        source: '/_next/static/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable', // Static assets long cache
          },
        ],
      },
      {
        source: '/favicon.ico',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },

  // Disable service worker caching issues
  experimental: {
    // Ensures new deployments clear old caches better
  },
};

module.exports = nextConfig;
