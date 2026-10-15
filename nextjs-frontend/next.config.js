/** @type {import('next').NextConfig} */
const nextConfig = {
  // Local LLM/VLM backends are slower than the cloud APIs this proxy timeout
  // (default 30s) was tuned for — raised so a slow agent call doesn't 500.
  experimental: {
    proxyTimeout: 180_000,
  },
  async rewrites() {
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
    return [
      { source: '/run/:path*',          destination: `${backendUrl}/run/:path*` },
      { source: '/extract-contract',    destination: `${backendUrl}/extract-contract` },
      { source: '/health',              destination: `${backendUrl}/health` },
      { source: '/download/:path*',     destination: `${backendUrl}/download/:path*` },
    ];
  },
};

module.exports = nextConfig;
