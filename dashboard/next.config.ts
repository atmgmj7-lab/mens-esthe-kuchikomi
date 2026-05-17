import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  basePath: "/wp-content/themes/swell_child/dashboard",
  assetPrefix: "/wp-content/themes/swell_child/dashboard",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
