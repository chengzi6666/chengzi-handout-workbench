import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  ...(process.env.NEXT_STANDALONE === "true" ? { output: "standalone" as const } : {}),
  experimental: {
    serverActions: {
      bodySizeLimit: "50mb"
    }
  }
};

export default nextConfig;
