import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@durandal/core", "@durandal/db"],
  output: "standalone",
};

export default nextConfig;
