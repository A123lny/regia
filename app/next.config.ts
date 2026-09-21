import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Supabase Storage locale (sviluppo)
      {
        protocol: "http",
        hostname: "127.0.0.1",
        port: "54520",
        pathname: "/storage/v1/object/sign/**",
      },
      // Supabase Storage produzione (*.supabase.co)
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/sign/**",
      },
    ],
  },
};

export default nextConfig;
