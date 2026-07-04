import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  trailingSlash: true,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "mens-esthe-kuchikomi.com" },
      { protocol: "http", hostname: "mens-esthe-kuchikomi.com" },
      { protocol: "https", hostname: "images.unsplash.com" }
    ]
  },
  async rewrites() {
    return [
      {
        source: "/wp-login.php",
        destination: "/api/proxy/wp-login"
      },
      {
        source: "/wp-login.php/",
        destination: "/api/proxy/wp-login"
      }
    ];
  },
  async redirects() {
    return [
      {
        source: "/listing",
        destination: "/storelisting/",
        permanent: true
      },
      {
        source: "/listing/",
        destination: "/storelisting/",
        permanent: true
      },
      // Legacy WordPress sitemap URLs → headless sitemap
      {
        source: "/wp-sitemap.xml",
        destination: "/sitemap.xml",
        permanent: true
      },
      {
        source: "/sitemap_index.xml",
        destination: "/sitemap.xml",
        permanent: true
      },
      {
        source: "/wp-sitemap-posts-post-1.xml",
        destination: "/sitemap.xml",
        permanent: true
      },
      {
        source: "/wp-sitemap-posts-page-1.xml",
        destination: "/sitemap.xml",
        permanent: true
      },
      {
        source: "/wp-sitemap-taxonomies-area-1.xml",
        destination: "/sitemap.xml",
        permanent: true
      },
      {
        source: "/wp-sitemap-:slug",
        destination: "/sitemap.xml",
        permanent: true
      }
    ];
  }
};

export default nextConfig;
