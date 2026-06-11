import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root so Turbopack doesn't get confused by lockfiles in
  // parent directories (silences the inferred-root warning).
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
