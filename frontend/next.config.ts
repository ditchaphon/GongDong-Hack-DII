import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // One HTTPS origin → Next.js; everything under /api except routes Next.js
  // owns (e.g. /api/auth/line) is proxied to the Express backend.
  async rewrites() {
    const backend = (
      process.env.BACKEND_INTERNAL_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      "http://127.0.0.1:8000"
    ).replace(/\/+$/, "");
    return {
      beforeFiles: [],
      afterFiles: [{ source: "/api/:path*", destination: `${backend}/api/:path*` }],
      fallback: [],
    };
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
};

export default nextConfig;

