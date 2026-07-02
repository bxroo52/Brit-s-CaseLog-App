import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PWA and other settings are primarily configured via vercel.json for deployment.
  // next.config headers still apply in development.

  // Completely disable Next.js dev indicators (floating panel in bottom-left with Route, Bundler, Preferences, etc.)
  devIndicators: false,
};

export default nextConfig;
