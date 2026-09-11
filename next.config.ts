import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["jsonwebtoken", "bcryptjs"],
  outputFileTracingExcludes: {
    "*": [
      "node_modules/@tensorflow/**",
      "node_modules/face-api.js/**",
      "node_modules/@tensorflow-models/**",
    ],
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        encoding: false,
        canvas: false,
      };
    }
    return config;
  },
};

export default nextConfig;
