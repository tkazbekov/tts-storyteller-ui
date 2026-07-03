import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  async rewrites() {
    // When the browser talks to the API directly, no rewrite is needed.
    if (process.env.NEXT_PUBLIC_API_URL) return [];
    // Otherwise the browser uses /api and the Next server proxies to the
    // backend; API_URL lets the proxy target differ from localhost.
    const destination = process.env.API_URL ?? "http://localhost:8000";
    return [{ source: "/api/:path*", destination: `${destination}/:path*` }];
  },
};

export default nextConfig;
