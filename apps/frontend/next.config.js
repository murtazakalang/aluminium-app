/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: 'standalone', // Enable standalone output
  
  // Disable Next.js branding and development overlays
  devIndicators: {
    buildActivity: false,
    buildActivityPosition: 'bottom-right',
  },
  
  // Disable telemetry
  telemetry: false,
  
  // Disable the development overlay completely
  experimental: {
    forceSwcTransforms: true,
  },
  
  // Custom webpack config to remove development indicators
  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) {
      // Remove Next.js development indicators
      config.plugins = config.plugins.filter((plugin) => {
        return plugin.constructor.name !== 'ReactRefreshWebpackPlugin'
      })
    }
    return config
  },
  
  // Add other configurations here if needed
};

module.exports = nextConfig; 