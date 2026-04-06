import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@durandal/core", "@durandal/db", "@durandal/vault"],
  serverExternalPackages: ["better-sqlite3"],
  output: "standalone",
};

export default nextConfig;
