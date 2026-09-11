import type { NextConfig } from "next";
import path from "path";

const faceApiBrowserBundle = path.join(
  process.cwd(),
  "node_modules/face-api.js/dist/face-api.js"
);

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    domains: [],
  },
  serverExternalPackages: ["face-api.js"],
  webpack: (config, { isServer }) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "face-api.js": faceApiBrowserBundle,
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
