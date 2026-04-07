import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@durandal/core", "@durandal/vault"],
  serverExternalPackages: ["better-sqlite3", "@durandal/db"],
  output: "standalone",
};

export default nextConfig;
