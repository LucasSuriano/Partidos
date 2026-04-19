import type { NextConfig } from "next";

const isCapacitor = process.env.IS_CAPACITOR === 'true';

const nextConfig: NextConfig = {
  output: isCapacitor ? 'export' : undefined,
  images: {
    unoptimized: true,
  },
  /* config options here */
};

export default nextConfig;
