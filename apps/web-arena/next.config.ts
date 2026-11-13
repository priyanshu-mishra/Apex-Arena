import type { NextConfig } from "next";

const isPages = process.env.NEXT_PUBLIC_STATIC_DEMO === "true";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  basePath,
  ...(isPages
    ? {
        output: "export",
        trailingSlash: true,
        images: { unoptimized: true },
        // All UI pages are TSX; omit the Node-only route.ts API bridge.
        pageExtensions: ["tsx", "jsx"],
      }
    : {}),
  // Allows a production build alongside a running dev server: NEXT_DIST_DIR=.next-build bun run build
  distDir: process.env.NEXT_DIST_DIR || ".next",
  ...(!isPages
    ? {
        async headers() {
          return [
            {
              source: "/(.*)",
              headers: [
                {
                  key: "Cross-Origin-Opener-Policy",
                  value: "same-origin",
                },
                {
                  key: "Cross-Origin-Embedder-Policy",
                  value: "require-corp",
                },
              ],
            },
          ];
        },
      }
    : {}),
};

export default nextConfig;
