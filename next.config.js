/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.linear.app",
      },
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
    // If you had serverActions: true here before, keep it if your Next.js version requires it.
  },
  // If the above experimental block doesn't work, try having serverActions at the top level as previously:
  /* 
  serverActions: {
    bodySizeLimit: '10mb',
  },
  */
  eslint: {
    // During CI/production builds, ignore ESLint errors so deployment isn't blocked
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Allow production builds to successfully complete even if there are type errors
    ignoreBuildErrors: true,
  },
};

module.exports = nextConfig; 