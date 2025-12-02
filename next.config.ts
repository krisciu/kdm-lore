import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable React strict mode for catching potential issues
  reactStrictMode: true,

  // Configure image optimization
  images: {
    // Add any external image domains you need
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'kingdomdeath.com',
      },
    ],
    // Disable image optimization for static export if needed
    unoptimized: process.env.NODE_ENV === 'development',
  },

  // Environment variables that should be available at build time
  env: {
    // Flag to indicate we're in production (read-only filesystem)
    IS_VERCEL: process.env.VERCEL === '1' ? 'true' : 'false',
  },

  // Serverless function configuration
  serverExternalPackages: [],

  // Output configuration for Vercel
  // Using default (server) for full API route support
  
  // Increase timeout for API routes that use AI
  experimental: {
    // Enable server actions if needed in the future
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },

  // Headers for security
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
    ];
  },

  // Turbopack configuration (for Next.js 16+)
  turbopack: {},

  // Webpack configuration (fallback if not using turbopack)
  webpack: (config, { isServer }) => {
    // Handle any server-only modules
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
      };
    }
    return config;
  },
};

export default nextConfig;
