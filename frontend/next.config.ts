import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: false, // true면 dev 서버 느려질 수 있음
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://127.0.0.1:8000/:path*",
      },
    ];
  },
};

export default nextConfig;
