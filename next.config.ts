import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Restored Turbopack build artifacts served outdated CSS on Vercel.
  // Rebuild production assets while retaining normal development caching.
  experimental: { turbopackFileSystemCacheForBuild: false },
};

export default nextConfig;
