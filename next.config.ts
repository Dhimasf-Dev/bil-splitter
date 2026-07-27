import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "192.168.100.199",
    "192.168.100.*",
    "192.168.*.*",
    "localhost:3000",
    "0.0.0.0:3000",
  ],
};

export default nextConfig;
