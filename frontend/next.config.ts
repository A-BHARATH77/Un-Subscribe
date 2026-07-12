import type { NextConfig } from "next";

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:5000";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      // Proxy all API calls to Flask backend
      {
        source: "/api/:path*",
        destination: `${BACKEND_URL}/api/:path*`,
      },
      // Proxy OAuth + auth routes to Flask backend
      {
        source: "/authorize",
        destination: `${BACKEND_URL}/authorize`,
      },
      {
        source: "/oauth2callback",
        destination: `${BACKEND_URL}/oauth2callback`,
      },
      {
        source: "/logout",
        destination: `${BACKEND_URL}/logout`,
      },
    ];
  },
};

export default nextConfig;
