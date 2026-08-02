import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Enables forbidden()/unauthorized() interrupts used by lib/auth/guards.ts.
    authInterrupts: true,
  },
};

export default nextConfig;
