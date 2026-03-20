import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    appDir: false, // Desactiva App Router para usar Pages Router
  },
};

export default nextConfig;
