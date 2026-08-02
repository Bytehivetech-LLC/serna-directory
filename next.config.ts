import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Enables forbidden()/unauthorized() interrupts used by lib/auth/guards.ts.
    authInterrupts: true,
  },
  images: {
    // Supabase Storage public objects + Google avatar hosts (OAuth pictures).
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/object/public/**" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
};

export default nextConfig;
