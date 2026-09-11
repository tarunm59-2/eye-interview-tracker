import type { NextConfig } from "next";
import path from "path";

const faceApiBrowserBundle = path.join(
  process.cwd(),
  "node_modules/@vladmandic/face-api/dist/face-api.esm.js"
);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    domains: [],
  },
  serverExternalPackages: ["@vladmandic/face-api"],
  webpack: (config, { isServer }) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@vladmandic/face-api": faceApiBrowserBundle,
    };

    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        encoding: false,
        path: false,
        crypto: false,
      };
    }

    return config;
  },
};

export default nextConfig;
