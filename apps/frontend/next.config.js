/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone', // Enable standalone output
  
  // Disable development indicators for production builds
  devIndicators: {
    buildActivity: false,
  },
  
  // Disable telemetry
  // The 'telemetry' option is deprecated.
  // To disable telemetry, you can set the NEXT_TELEMETRY_DISABLED
  // environment variable to '1' in your docker-compose file.
  
  // Disable the development overlay completely
  experimental: {
    forceSwcTransforms: true,
  },
  
  // Custom webpack config is generally not needed for this.
  // Removing it simplifies the configuration.
  webpack: (config, { dev, isServer }) => {
    // You can add custom webpack configurations here if needed in the future.
    return config
  },
  
  // Disable ESLint during build if it's causing issues.
  // Warnings are useful, but shouldn't fail the build.
  eslint: {
    // Warning: This allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  
  // Add other configurations here if needed
};

module.exports = nextConfig; 