import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  webpack: (config) => {
    // Disable persistent filesystem cache to avoid EISDIR readlink issues on Windows
    config.cache = false;
    config.resolve.symlinks = false;
    return config;
  },
};

export default nextConfig;
